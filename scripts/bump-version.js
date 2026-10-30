import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const args = process.argv.slice(2);

// Check for --no-commit flag
const noCommit = args.includes("--no-commit");
const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
const targetArg = positionalArgs[0] || "patch";

console.log(`\n========================================`);
console.log(`  FocusHUD Version Bump: ${targetArg}`);
console.log(`========================================\n`);

try {
  // 1. Run npm version to compute and update package.json & package-lock.json
  console.log(`📦 Bumping frontend version (${targetArg})...`);
  execSync(`npm version ${targetArg} --no-git-tag-version --allow-same-version`, { stdio: "inherit" });

  const pkgJsonPath = path.join(rootDir, "package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const newVersion = pkgJson.version;
  console.log(`✨ Target version: v${newVersion}\n`);

  // 2. Update src-tauri/tauri.conf.json
  const tauriConfPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
  if (fs.existsSync(tauriConfPath)) {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
    tauriConf.version = newVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n", "utf8");
    console.log(`  ✓ Updated src-tauri/tauri.conf.json -> ${newVersion}`);
  }

  // 3. Update src-tauri/Cargo.toml ([package] version = "...")
  const cargoTomlPath = path.join(rootDir, "src-tauri", "Cargo.toml");
  if (fs.existsSync(cargoTomlPath)) {
    let cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
    cargoToml = cargoToml.replace(
      /(\[package\][\s\S]*?^version\s*=\s*")[^"]*(")/m,
      `$1${newVersion}$2`
    );
    fs.writeFileSync(cargoTomlPath, cargoToml, "utf8");
    console.log(`  ✓ Updated src-tauri/Cargo.toml -> ${newVersion}`);
  }

  // 4. Synchronize src-tauri/Cargo.lock
  console.log(`\n🦀 Synchronizing src-tauri/Cargo.lock...`);
  execSync(`cargo check --manifest-path src-tauri/Cargo.toml`, { stdio: "inherit" });
  console.log(`  ✓ Synchronized src-tauri/Cargo.lock`);

  // 5. Stage and Commit unless --no-commit was requested
  const filesToStage = [
    "package.json",
    "package-lock.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "src-tauri/Cargo.lock",
  ].filter((f) => fs.existsSync(path.join(rootDir, f)));

  if (noCommit) {
    console.log(`\nℹ️  --no-commit specified. Staging files without committing...`);
    execSync(`git add ${filesToStage.join(" ")}`, { stdio: "inherit" });
    console.log(`  ✓ Staged ${filesToStage.length} files.`);
  } else {
    console.log(`\n📝 Staging and committing release bump...`);
    execSync(`git add ${filesToStage.join(" ")}`, { stdio: "inherit" });
    execSync(`git commit -m "chore(release): bump version to ${newVersion}"`, { stdio: "inherit" });
    console.log(`  ✓ Created commit: "chore(release): bump version to ${newVersion}"`);
  }

  console.log(`\n🎉 Successfully bumped FocusHUD to v${newVersion}!`);
  console.log(`\nNext steps:`);
  console.log(`  1. Push your branch & open PR to main:`);
  console.log(`     git push -u origin <branch-name>`);
  console.log(`  2. After merging PR into main, tag to publish release:`);
  console.log(`     git checkout main && git pull`);
  console.log(`     git tag -a v${newVersion} -m "Release v${newVersion}"`);
  console.log(`     git push origin v${newVersion}\n`);
} catch (error) {
  console.error(`\n❌ Error during version bump:`, error.message);
  process.exit(1);
}
