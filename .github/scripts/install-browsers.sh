#!/usr/bin/env bash
# Installs Playwright's browsers and the Ubuntu packages they need on a GitHub-hosted runner, with
# every download bounded. The runner's first apt mirror, azure.archive.ubuntu.com, sometimes
# serves packages at a few kB/s, and apt leaves a mirror only when it fails or goes silent, so a
# slow first attempt is stopped and the packages are installed from archive.ubuntu.com instead
# (actions/runner-images#14823). A slow browser download is stopped and retried once.
# Runs only on Linux, in CI.
# Usage: install-browsers.sh [-h] <package-directory> <browser>...
#   such as: install-browsers.sh packages/jg-sw chromium firefox webkit
set -euo pipefail
shopt -s inherit_errexit

# the mirror list GitHub's Ubuntu images point apt at, and the Azure mirror it lists first
readonly APT_MIRRORS_FILE=/etc/apt/apt-mirrors.txt
readonly AZURE_MIRROR_PATTERN='azure\.archive\.ubuntu\.com'

# the packages normally install in under a minute and a half, and the browsers download in under
# 30 seconds; a stopped attempt that hasn't exited after KILL_AFTER is killed
readonly PACKAGES_TIME_LIMIT=3m
readonly PACKAGES_RETRY_TIME_LIMIT=8m
readonly BROWSERS_TIME_LIMIT=3m
readonly KILL_AFTER=15s

usage() {
  printf 'Usage: %s [-h] <package-directory> <browser>...\n' "${0##*/}"
}

die() {
  printf '%s: %s\n' "${0##*/}" "$*" >&2
  exit 1
}

# prints a GitHub Actions warning annotation
warn() {
  printf '::warning::%s\n' "$*" >&2
}

# installs the packages with Playwright running as root, so timeout, also root, can stop apt-get
# and dpkg; sudo's own PATH would hide Node.js
install_packages() {
  local time_limit="$1" playwright="$2"
  shift 2
  sudo env "PATH=$PATH" timeout --kill-after="$KILL_AFTER" "$time_limit" \
    "$playwright" install-deps "$@"
}

# removes the Azure mirror from apt's list, so the next attempt uses archive.ubuntu.com
use_ubuntu_mirror() {
  if [[ ! -f "$APT_MIRRORS_FILE" ]]; then
    warn "$APT_MIRRORS_FILE doesn't exist, so the retry uses the same mirrors."
    return
  fi
  sudo sed -i -e "/${AZURE_MIRROR_PATTERN}/d" "$APT_MIRRORS_FILE"
}

download_browsers() {
  local playwright="$1"
  shift
  timeout --kill-after="$KILL_AFTER" "$BROWSERS_TIME_LIMIT" "$playwright" install "$@"
}

main() {
  case "${1-}" in
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      usage >&2
      exit 2
      ;;
  esac
  if (($# < 2)); then
    usage >&2
    exit 2
  fi

  command -v sudo >/dev/null || die "sudo is required but not installed"
  command -v timeout >/dev/null || die "timeout is required but not installed"

  local playwright="$1/node_modules/.bin/playwright"
  shift
  [[ -x "$playwright" ]] || die "Playwright isn't installed: $playwright"

  local status=0
  install_packages "$PACKAGES_TIME_LIMIT" "$playwright" "$@" || status=$?
  if ((status != 0)); then
    warn "Installing the browsers' packages failed or took over $PACKAGES_TIME_LIMIT (exit code $status), so they're installed from archive.ubuntu.com instead."
    use_ubuntu_mirror
    # an attempt stopped while dpkg ran leaves packages unconfigured, which apt-get refuses
    sudo dpkg --configure -a
    install_packages "$PACKAGES_RETRY_TIME_LIMIT" "$playwright" "$@"
  fi

  status=0
  download_browsers "$playwright" "$@" || status=$?
  if ((status != 0)); then
    warn "Downloading the browsers failed or took over $BROWSERS_TIME_LIMIT (exit code $status), so they're downloaded again."
    download_browsers "$playwright" "$@"
  fi
}

main "$@"
