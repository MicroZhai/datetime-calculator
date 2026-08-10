/*
 * Compatibility range guard.
 * The arithmetic core accepts arbitrary-precision durations. This bridge
 * protects legacy Web/PWA paths that still expect bounded numeric input; a
 * HarmonyOS port should enforce the same input-digit rule at the keypad/state
 * boundary, not truncate the computed BigInt result.
 */
(() => {
  // v13: 数值大小由 BigInt 任意精度引擎处理，不再设置固定“最大天数/小时数”上限。
  // 保留该文件作为旧 PWA 缓存与加载顺序的兼容占位；资源保护由输入层的 100 位数字限制承担。
})();
