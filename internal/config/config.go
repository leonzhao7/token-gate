package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	ListenAddr      string
	DBPath          string
	AdminToken      string
	LogLevel        string
	BackendCooldown time.Duration
	RequestTimeout  time.Duration
	ShutdownTimeout time.Duration
}

func Load() Config {
	return Config{
		ListenAddr:      getenv("TG_LISTEN_ADDR", ":8080"),
		DBPath:          getenv("TG_DB_PATH", "./token-gate.db"),
		AdminToken:      getenv("TG_ADMIN_TOKEN", "dev-admin-token"),
		LogLevel:        getenv("TG_LOG_LEVEL", "info"),
		BackendCooldown: getDuration("TG_BACKEND_COOLDOWN", 20*time.Second),
		RequestTimeout:  getDuration("TG_REQUEST_TIMEOUT", 30*time.Second),
		ShutdownTimeout: getDuration("TG_SHUTDOWN_TIMEOUT", 10*time.Second),
	}
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
