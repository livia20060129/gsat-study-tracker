import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const platform = process.argv[2];
if (platform === 'android') {
  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT && !existsSync('android/local.properties')) {
    throw new Error('尚未設定 Android SDK。請先在 Android Studio 安裝 SDK 36，依 NATIVE_APP_SETUP.md 設定後重試。');
  }
  const windows = process.platform === 'win32';
  const java = process.env.JAVA_HOME ? resolve(process.env.JAVA_HOME, 'bin', windows ? 'java.exe' : 'java') : 'java';
  const javaVersion = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const major = Number(/version "(\d+)/.exec((javaVersion.stderr ?? '') + (javaVersion.stdout ?? ''))?.[1]);
  if (javaVersion.error || !Number.isInteger(major) || major < 21 || major > 24) {
    throw new Error('命令列 Java 尚未就緒，請將 JAVA_HOME 指向 JDK 21，再重新建置。');
  }
  const result = windows
    ? spawnSync('cmd.exe', ['/d', '/c', 'gradlew.bat', 'testDebugUnitTest', 'assembleDebug'], { cwd: resolve('android'), stdio: 'inherit' })
    : spawnSync('sh', ['./gradlew', 'testDebugUnitTest', 'assembleDebug'], { cwd: resolve('android'), stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} else if (platform === 'ios') {
  if (process.platform !== 'darwin') throw new Error('iPhone／iPad 建置需要 Mac 與 Xcode；目前僅準備工程與網頁資產。');
  const result = spawnSync('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App',
    '-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', 'native-build/ios', 'CODE_SIGNING_ALLOWED=NO', 'build'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} else throw new Error('Choose android or ios');
