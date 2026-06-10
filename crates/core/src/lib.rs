use napi_derive::napi;
use napi::{Result, Error, Status};
use std::cell::RefCell;

/// Walk a directory and return all file paths (respects .gitignore)
#[napi]
pub fn walk_directory(dir: String, max_depth: Option<u32>) -> Result<Vec<String>> {
  let mut builder = ignore::WalkBuilder::new(&dir);
  if let Some(depth) = max_depth {
    builder.max_depth(Some(depth as usize));
  }
  builder.hidden(false).git_ignore(true);

  let mut paths = Vec::new();
  for entry in builder.build() {
    if let Ok(e) = entry {
      paths.push(e.path().to_string_lossy().to_string());
    }
  }
  Ok(paths)
}

#[napi(object)]
pub struct SearchResult {
  pub file_path: String,
  pub line_number: u32,
  pub line_content: String,
  pub match_start: u32,
  pub match_end: u32,
}

/// Fast full-text search using ripgrep-style logic
#[napi]
pub fn search_in_files(
  dir: String,
  query: String,
  case_sensitive: Option<bool>,
  use_regex: Option<bool>,
) -> Result<Vec<SearchResult>> {
  use regex::RegexBuilder;

  let cs = case_sensitive.unwrap_or(false);
  let pattern = if use_regex.unwrap_or(false) {
    query.clone()
  } else {
    regex::escape(&query)
  };

  let re = RegexBuilder::new(&pattern)
    .case_insensitive(!cs)
    .build()
    .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid regex: {e}")))?;

  let mut results = Vec::new();

  let walker = ignore::WalkBuilder::new(&dir)
    .git_ignore(true)
    .hidden(false)
    .build();

  for entry in walker.flatten() {
    let path = entry.path().to_owned();
    if !path.is_file() { continue; }

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ["png","jpg","jpeg","gif","ico","svg","woff","woff2","ttf","eot",
        "zip","tar","gz","exe","dll","so","dylib","pdf","lock"]
      .contains(&ext) { continue; }

    let content = match std::fs::read_to_string(&path) {
      Ok(c) => c,
      Err(_) => continue,
    };

    let path_str = path.to_string_lossy().to_string();
    for (line_idx, line) in content.lines().enumerate() {
      if let Some(m) = re.find(line) {
        results.push(SearchResult {
          file_path: path_str.clone(),
          line_number: (line_idx + 1) as u32,
          line_content: line.to_string(),
          match_start: m.start() as u32,
          match_end: m.end() as u32,
        });
      }
    }

    if results.len() > 5000 { break; }
  }

  Ok(results)
}

#[napi(object)]
pub struct DiffHunk {
  pub header: String,
  pub lines: Vec<String>,
}

#[napi(object)]
pub struct FileDiff {
  pub old_path: String,
  pub new_path: String,
  pub hunks: Vec<DiffHunk>,
  pub added: u32,
  pub deleted: u32,
}

// Internal types for flat collection
struct RawHunk  { new_path: String, old_path: String, header: String }
struct RawLine2 { new_path: String, content: String, origin: char }
enum RawEntry { Hunk(RawHunk), Line(RawLine2) }

/// Get git diff for all changed files in a repo
#[napi]
pub fn get_git_diff(repo_path: String) -> Result<Vec<FileDiff>> {
  let repo = git2::Repository::open(&repo_path)
    .map_err(|e| Error::new(Status::GenericFailure, format!("Git error: {e}")))?;

  let diff = repo
    .diff_index_to_workdir(None, None)
    .map_err(|e| Error::new(Status::GenericFailure, format!("Diff error: {e}")))?;

  // Use RefCell so both closures can push to the same Vec
  // without conflicting mutable borrows at the type-system level
  let raw: RefCell<Vec<RawEntry>> = RefCell::new(Vec::new());

  diff.foreach(
    &mut |_, _| true,
    None,
    Some(&mut |delta, hunk| {
      let new_path = delta.new_file().path()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
      let old_path = delta.old_file().path()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
      let header = String::from_utf8_lossy(hunk.header()).to_string();
      raw.borrow_mut().push(RawEntry::Hunk(RawHunk { new_path, old_path, header }));
      true
    }),
    Some(&mut |delta, _, line| {
      let new_path = delta.new_file().path()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
      let content = String::from_utf8_lossy(line.content()).to_string();
      let origin = line.origin();
      raw.borrow_mut().push(RawEntry::Line(RawLine2 { new_path, content, origin }));
      true
    }),
  ).map_err(|e| Error::new(Status::GenericFailure, format!("Diff foreach error: {e}")))?;

  // Build FileDiff from flat entries — single owner, no borrow issues
  let mut diffs: Vec<FileDiff> = Vec::new();

  for entry in raw.into_inner() {
    match entry {
      RawEntry::Hunk(h) => {
        if let Some(file) = diffs.iter_mut().rfind(|d| d.new_path == h.new_path) {
          file.hunks.push(DiffHunk { header: h.header, lines: Vec::new() });
        } else {
          diffs.push(FileDiff {
            old_path: h.old_path,
            new_path: h.new_path,
            hunks: vec![DiffHunk { header: h.header, lines: Vec::new() }],
            added: 0,
            deleted: 0,
          });
        }
      }
      RawEntry::Line(l) => {
        let prefix = match l.origin { '+' => "+", '-' => "-", _ => " " };
        if let Some(file) = diffs.iter_mut().rfind(|d| d.new_path == l.new_path) {
          match l.origin { '+' => file.added += 1, '-' => file.deleted += 1, _ => {} }
          if let Some(hunk) = file.hunks.last_mut() {
            hunk.lines.push(format!("{prefix}{}", l.content));
          }
        }
      }
    }
  }

  Ok(diffs)
}

/// Check if a path is inside a git repo and return the root
#[napi]
pub fn find_git_root(path: String) -> Option<String> {
  git2::Repository::discover(&path)
    .ok()
    .and_then(|r| r.workdir().map(|p| p.to_string_lossy().to_string()))
}