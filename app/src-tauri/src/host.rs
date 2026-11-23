//! Starting programs on the host from an AppImage. An AppImage runs with its own libraries and tools first on the search
//! paths (LD_LIBRARY_PATH, PATH, GIO_MODULE_DIR, GTK_PATH, ...). Passed on to xdg-open and the file manager or browser it
//! starts, those make the host programs load the AppImage's bundled GTK and GLib, and they fail. Programs ArkMD starts get
//! the environment without those entries.

use std::process::{Command, Stdio};

/// Variables that hold search paths or module locations an AppImage points at its own files.
const BUNDLE_VARS: &[&str] = &[
    "PATH", "LD_LIBRARY_PATH", "XDG_DATA_DIRS", "GIO_MODULE_DIR", "GIO_EXTRA_MODULES", "GTK_PATH", "GTK_EXE_PREFIX",
    "GTK_DATA_PREFIX", "GTK_IM_MODULE_FILE", "GDK_PIXBUF_MODULE_FILE", "GSETTINGS_SCHEMA_DIR", "GST_PLUGIN_SYSTEM_PATH",
    "GST_PLUGIN_SYSTEM_PATH_1_0", "GST_PLUGIN_PATH", "PERLLIB", "QT_PLUGIN_PATH", "PYTHONPATH", "PYTHONHOME",
];

/// `value` without the entries inside the AppImage's mount (any "/.mount_" folder, or `appdir`); None when nothing is left.
pub fn without_bundle(value: &str, appdir: Option<&str>) -> Option<String> {
    let kept: Vec<&str> = value
        .split(':')
        .filter(|entry| !entry.is_empty())
        .filter(|entry| !entry.contains("/.mount_") && !appdir.map(|d| !d.is_empty() && entry.starts_with(d)).unwrap_or(false))
        .collect();
    if kept.is_empty() { None } else { Some(kept.join(":")) }
}

/// A command for a host program, with the AppImage's entries removed from its environment and no terminal attached.
pub fn host_command(program: &str) -> Command {
    let appdir = std::env::var("APPDIR").ok();
    let mut command = Command::new(program);
    for var in BUNDLE_VARS {
        if let Ok(value) = std::env::var(var) {
            match without_bundle(&value, appdir.as_deref()) {
                Some(clean) if clean != value => { command.env(var, clean); }
                None => { command.env_remove(var); }
                _ => {}
            }
        }
    }
    command.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    command
}

/// Open a folder or an address with the desktop's own handler (xdg-open, then gio).
#[cfg(target_os = "linux")]
pub fn open_target(target: &str) -> Result<(), String> {
    let mut last = String::from("no program found to open it");
    for (program, args) in [("xdg-open", &[][..]), ("gio", &["open"][..])] {
        match host_command(program).args(args).arg(target).spawn() {
            Ok(mut child) => {
                // xdg-open can stay alive while the file manager runs; reap it in the background.
                std::thread::spawn(move || { let _ = child.wait(); });
                return Ok(());
            }
            Err(e) => last = format!("{program}: {e}"),
        }
    }
    Err(last)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drops_entries_inside_the_appimage_mount() {
        let path = "/tmp/.mount_ArkMDabc/usr/bin/:/tmp/.mount_ArkMDold/usr/bin/:/usr/local/bin:/usr/bin";
        assert_eq!(without_bundle(path, Some("/tmp/.mount_ArkMDabc")).as_deref(), Some("/usr/local/bin:/usr/bin"));
    }

    #[test]
    fn leaves_a_clean_value_alone_and_empties_a_bundle_only_one() {
        assert_eq!(without_bundle("/usr/lib:/lib", None).as_deref(), Some("/usr/lib:/lib"));
        assert_eq!(without_bundle("/tmp/.mount_ArkMDabc//usr/lib/gio/modules", Some("/tmp/.mount_ArkMDabc")), None);
        assert_eq!(without_bundle("", None), None);
    }

    #[test]
    fn uses_the_app_dir_even_when_it_is_not_a_mount_name() {
        assert_eq!(without_bundle("/opt/arkmd/lib:/usr/lib", Some("/opt/arkmd")).as_deref(), Some("/usr/lib"));
    }
}
