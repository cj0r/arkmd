//! Saving a file without ever leaving it half written. The new text goes to a temporary file in the same folder, is
//! flushed to disk, and then replaces the original in one step, so a crash, a full disk or a power cut leaves either the
//! old file or the new one, never a truncated mix.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// The temporary name next to `path`: hidden, and unique enough that two saves never collide.
fn temp_path(path: &Path) -> PathBuf {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "file".into());
    path.with_file_name(format!(".{name}.arkmd-{}.tmp", std::process::id()))
}

/// Replace the contents of `path` with `bytes`.
///
/// A symbolic link is followed, so the file it points to is the one replaced and the link stays. If the folder doesn't
/// allow creating a new file (the file itself is writable but its folder is not), this falls back to writing the file
/// in place, which is what a plain save does.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let target = match path.canonicalize() {
        Ok(real) => real,
        Err(_) => path.to_path_buf(),     // a file that doesn't exist yet
    };
    let temp = temp_path(&target);
    let attempt = (|| -> std::io::Result<()> {
        let mut file = fs::File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        if let Ok(meta) = fs::metadata(&target) {
            let _ = fs::set_permissions(&temp, meta.permissions());     // keep the original's mode (for example 0600)
        }
        drop(file);
        fs::rename(&temp, &target)
    })();
    match attempt {
        Ok(()) => Ok(()),
        Err(e) => {
            let _ = fs::remove_file(&temp);
            if e.kind() == std::io::ErrorKind::PermissionDenied && target.exists() {
                let mut file = fs::OpenOptions::new().write(true).truncate(true).open(&target)?;
                file.write_all(bytes)?;
                file.sync_all()
            } else {
                Err(e)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("arkmd-save-test-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn replaces_the_contents_and_leaves_no_temp_file() {
        let dir = scratch("replace");
        let file = dir.join("note.md");
        fs::write(&file, "old").unwrap();
        write_atomic(&file, "new text — ✓".as_bytes()).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "new text — ✓");
        let leftovers: Vec<_> = fs::read_dir(&dir).unwrap().map(|e| e.unwrap().file_name()).collect();
        assert_eq!(leftovers, vec![std::ffi::OsString::from("note.md")]);
    }

    #[test]
    fn creates_a_file_that_does_not_exist_yet() {
        let dir = scratch("create");
        let file = dir.join("new.md");
        write_atomic(&file, b"hello").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "hello");
    }

    #[cfg(unix)]
    #[test]
    fn keeps_the_file_mode_and_follows_symlinks() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let dir = scratch("unix");
        let real = dir.join("real.md");
        fs::write(&real, "old").unwrap();
        fs::set_permissions(&real, fs::Permissions::from_mode(0o600)).unwrap();
        let link = dir.join("link.md");
        symlink(&real, &link).unwrap();
        write_atomic(&link, b"via link").unwrap();
        assert_eq!(fs::read_to_string(&real).unwrap(), "via link");
        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(fs::metadata(&real).unwrap().permissions().mode() & 0o777, 0o600);
    }

    #[test]
    fn a_failed_write_leaves_the_original_untouched() {
        let dir = scratch("missing-dir");
        let file = dir.join("no-such-folder").join("note.md");
        assert!(write_atomic(&file, b"x").is_err());
        assert!(!dir.join("no-such-folder").exists());
    }
}
