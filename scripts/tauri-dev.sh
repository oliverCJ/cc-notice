#!/usr/bin/env sh
set -eu

if [ "$(uname -s)" = "Darwin" ]; then
  XCODE_DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
  CLT_DEVELOPER_DIR="/Library/Developer/CommandLineTools"

  if [ -z "${SDKROOT:-}" ]; then
    if [ -d "$XCODE_DEVELOPER_DIR/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk" ]; then
      export SDKROOT="$XCODE_DEVELOPER_DIR/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
    elif [ -d "$CLT_DEVELOPER_DIR/SDKs/MacOSX.sdk" ]; then
      export SDKROOT="$CLT_DEVELOPER_DIR/SDKs/MacOSX.sdk"
    fi
  fi

  if [ -z "${CC:-}" ] && [ -x "$XCODE_DEVELOPER_DIR/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang" ]; then
    export CC="$XCODE_DEVELOPER_DIR/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang"
  elif [ -z "${CC:-}" ] && [ -x "$CLT_DEVELOPER_DIR/usr/bin/clang" ]; then
    export CC="$CLT_DEVELOPER_DIR/usr/bin/clang"
  fi

  if [ -z "${CXX:-}" ] && [ -x "$XCODE_DEVELOPER_DIR/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang++" ]; then
    export CXX="$XCODE_DEVELOPER_DIR/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang++"
  elif [ -z "${CXX:-}" ] && [ -x "$CLT_DEVELOPER_DIR/usr/bin/clang++" ]; then
    export CXX="$CLT_DEVELOPER_DIR/usr/bin/clang++"
  fi

  if [ -z "${AR:-}" ] && [ -x "$XCODE_DEVELOPER_DIR/Toolchains/XcodeDefault.xctoolchain/usr/bin/ar" ]; then
    export AR="$XCODE_DEVELOPER_DIR/Toolchains/XcodeDefault.xctoolchain/usr/bin/ar"
  elif [ -z "${AR:-}" ] && [ -x "$CLT_DEVELOPER_DIR/usr/bin/ar" ]; then
    export AR="$CLT_DEVELOPER_DIR/usr/bin/ar"
  fi

  if [ -z "${RANLIB:-}" ] && [ -x "$XCODE_DEVELOPER_DIR/Toolchains/XcodeDefault.xctoolchain/usr/bin/ranlib" ]; then
    export RANLIB="$XCODE_DEVELOPER_DIR/Toolchains/XcodeDefault.xctoolchain/usr/bin/ranlib"
  elif [ -z "${RANLIB:-}" ] && [ -x "$CLT_DEVELOPER_DIR/usr/bin/ranlib" ]; then
    export RANLIB="$CLT_DEVELOPER_DIR/usr/bin/ranlib"
  fi
fi

exec tauri "$@"
