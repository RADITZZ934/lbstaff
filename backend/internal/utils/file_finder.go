package utils

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	httpPrefixRegex    = regexp.MustCompile(`^https?://[^/]+`)
	uploadsPrefixRegex = regexp.MustCompile(`^/?(uploads|upload)/?`)
)

func FindUploadFile(requestedPath string, baseUploadsDir string) string {
	if requestedPath == "" {
		return ""
	}

	clean := strings.ReplaceAll(requestedPath, "\\", "/")
	clean = httpPrefixRegex.ReplaceAllString(clean, "")
	clean = uploadsPrefixRegex.ReplaceAllString(clean, "")
	clean = strings.TrimLeft(clean, "/\\")
	clean = strings.Split(clean, "?")[0]

	if clean == "" {
		return ""
	}

	cleanOSPath := filepath.FromSlash(clean)
	cwd, _ := os.Getwd()

	searchDirs := []string{
		baseUploadsDir,
		filepath.Join(cwd, "uploads"),
		filepath.Join(cwd, "upload"),
		filepath.Join(cwd, "..", "uploads"),
		filepath.Join(cwd, "..", "upload"),
		cwd,
		"D:/lbstaff_uploads",
		"/home/radit/lbstaff_uploads",
	}

	for _, dir := range searchDirs {
		if dir == "" {
			continue
		}
		candidate := filepath.Join(dir, cleanOSPath)
		if fi, err := os.Stat(candidate); err == nil && !fi.IsDir() {
			return candidate
		}
	}

	return ""
}
