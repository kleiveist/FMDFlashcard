use std::io::{self, Read};

fn run() -> Result<(), String> {
    let mut source = String::new();
    io::stdin()
        .read_to_string(&mut source)
        .map_err(|error| format!("could not read Rust source: {error}"))?;
    let analysis = rust_quality_analyzer::analyze(&source).map_err(|error| error.to_string())?;
    let json = analysis.to_json();
    println!("{json}");
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(2);
    }
}
