package config

import (
	"context"
	"os"
	"strconv"
	"time"

	"token-gate/internal/store"
)

const DefaultBackendConsoleUserAgent = "Token-Gate/1.0"

type Config struct {
	ListenAddr              string
	DBPath                  string
	LogLevel                string
	BackendCooldown         time.Duration
	BackendFails            int
	BackendConsoleUserAgent string
	FocusModels             string
	RequestTimeout          time.Duration
	ShutdownTimeout         time.Duration
}

func Load() Config {
	return Config{
		ListenAddr:              getenv("TG_LISTEN_ADDR", ":8080"),
		DBPath:                  getenv("TG_DB_PATH", "./token-gate.db"),
		LogLevel:                getenv("TG_LOG_LEVEL", "info"),
		BackendCooldown:         getDuration("TG_BACKEND_COOLDOWN", 10*time.Minute),
		BackendFails:            getInt("TG_BACKEND_FAILS", 3),
		BackendConsoleUserAgent: getenv("TG_BACKEND_CONSOLE_USER_AGENT", DefaultBackendConsoleUserAgent),
		FocusModels:             getenv("TG_FOCUS_MODELS", ""),
		RequestTimeout:          getDuration("TG_REQUEST_TIMEOUT", 30*time.Second),
		ShutdownTimeout:         getDuration("TG_SHUTDOWN_TIMEOUT", 10*time.Second),
	}
}

func LoadDatabase(ctx context.Context, st *store.Store) (Config, error) {
	cfg := Load()
	settings, err := st.GetAllSettings(ctx)
	if err != nil {
		return cfg, err
	}
	if log_level, ok := settings["log_level"]; ok {
		cfg.LogLevel = log_level
	}
	if cooldown, ok := settings["backend_cooldown"]; ok {
		if d, err := time.ParseDuration(cooldown); err == nil {
			cfg.BackendCooldown = d
		}
	}
	if fails, ok := settings["backend_fails"]; ok {
		if n, err := strconv.Atoi(fails); err == nil {
			cfg.BackendFails = n
		}
	}
	if userAgent, ok := settings["backend_console_user_agent"]; ok {
		cfg.BackendConsoleUserAgent = userAgent
	}
	if focusModels, ok := settings["focus_models"]; ok {
		cfg.FocusModels = focusModels
	}
	if timeout, ok := settings["request_timeout"]; ok {
		if d, err := time.ParseDuration(timeout); err == nil {
			cfg.RequestTimeout = d
		}
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if parsed, err := time.ParseDuration(value); err == nil {
			return parsed
		}
		if seconds, err := strconv.Atoi(value); err == nil {
			return time.Duration(seconds) * time.Second
		}
	}
	return fallback
}

func getInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return fallback
}
