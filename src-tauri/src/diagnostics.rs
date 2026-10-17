use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{OnceLock, RwLock};
use std::time::Duration;
use nvml_wrapper::enum_wrappers::device::TemperatureSensor;
use nvml_wrapper::Nvml;
use serde::Serialize;
use sysinfo::System;

#[derive(Serialize, Clone, Debug)]
pub struct SystemDiagnostics {
    pub cpu_usage: f32,
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub ram_usage: f32,
    pub gpu_name: Option<String>,
    pub gpu_usage: Option<f32>,
    pub vram_used_bytes: Option<u64>,
    pub vram_total_bytes: Option<u64>,
    pub vram_usage: Option<f32>,
    pub gpu_temp: Option<u32>,
}

static DIAGNOSTICS_CACHE: OnceLock<RwLock<SystemDiagnostics>> = OnceLock::new();
static THREAD_STARTED: AtomicBool = AtomicBool::new(false);

fn get_cache() -> &'static RwLock<SystemDiagnostics> {
    DIAGNOSTICS_CACHE.get_or_init(|| {
        RwLock::new(SystemDiagnostics {
            cpu_usage: 0.0,
            cpu_name: String::new(),
            cpu_cores: 0,
            ram_used_bytes: 0,
            ram_total_bytes: 0,
            ram_usage: 0.0,
            gpu_name: None,
            gpu_usage: None,
            vram_used_bytes: None,
            vram_total_bytes: None,
            vram_usage: None,
            gpu_temp: None,
        })
    })
}

pub fn start_diagnostics_worker() {
    if THREAD_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }

    std::thread::spawn(|| {
        let mut sys = System::new_all();
        let nvml = Nvml::init().ok();

        // Initial warmup for CPU delta calculation
        sys.refresh_cpu_usage();
        sys.refresh_memory();

        loop {
            std::thread::sleep(Duration::from_millis(1000));

            sys.refresh_cpu_usage();
            sys.refresh_memory();

            let cpu_usage = sys.global_cpu_usage();
            let cpu_cores = sys.cpus().len();
            let cpu_name = sys
                .cpus()
                .first()
                .map(|c| c.brand().trim().to_string())
                .unwrap_or_else(|| "CPU".to_string());

            let ram_total = sys.total_memory();
            let ram_used = sys.used_memory();
            let ram_usage = if ram_total > 0 {
                (ram_used as f32 / ram_total as f32) * 100.0
            } else {
                0.0
            };

            let mut gpu_name = None;
            let mut gpu_usage = None;
            let mut vram_used_bytes = None;
            let mut vram_total_bytes = None;
            let mut vram_usage = None;
            let mut gpu_temp = None;

            if let Some(ref nv) = nvml {
                if let Ok(dev) = nv.device_by_index(0) {
                    gpu_name = dev.name().ok();
                    if let Ok(util) = dev.utilization_rates() {
                        gpu_usage = Some(util.gpu as f32);
                    }
                    if let Ok(mem) = dev.memory_info() {
                        vram_used_bytes = Some(mem.used);
                        vram_total_bytes = Some(mem.total);
                        if mem.total > 0 {
                            vram_usage = Some((mem.used as f32 / mem.total as f32) * 100.0);
                        }
                    }
                    gpu_temp = dev.temperature(TemperatureSensor::Gpu).ok();
                }
            }

            let diag = SystemDiagnostics {
                cpu_usage,
                cpu_name,
                cpu_cores,
                ram_used_bytes: ram_used,
                ram_total_bytes: ram_total,
                ram_usage,
                gpu_name,
                gpu_usage,
                vram_used_bytes,
                vram_total_bytes,
                vram_usage,
                gpu_temp,
            };

            if let Ok(mut lock) = get_cache().write() {
                *lock = diag;
            }
        }
    });
}

pub fn get_latest_diagnostics() -> SystemDiagnostics {
    start_diagnostics_worker();
    if let Ok(lock) = get_cache().read() {
        lock.clone()
    } else {
        SystemDiagnostics {
            cpu_usage: 0.0,
            cpu_name: "CPU".to_string(),
            cpu_cores: 0,
            ram_used_bytes: 0,
            ram_total_bytes: 0,
            ram_usage: 0.0,
            gpu_name: None,
            gpu_usage: None,
            vram_used_bytes: None,
            vram_total_bytes: None,
            vram_usage: None,
            gpu_temp: None,
        }
    }
}
