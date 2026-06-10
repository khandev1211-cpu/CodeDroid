extern crate napi_build;

fn main() {
    napi_build::setup();

    // Link Windows security + crypto libraries required by libgit2-sys
    println!("cargo:rustc-link-lib=advapi32");
    println!("cargo:rustc-link-lib=secur32");
    println!("cargo:rustc-link-lib=crypt32");
}