"use strict";
/**
 * 抖音强制加载的入口：先打日志，再 require 主包（避免 Helium 长时间解析大文件时无任何输出）。
 */
console.info("[crush-crush] douyin game.js shell");
try {
  require("./crush-bundle.js");
} catch (err) {
  console.error("[crush-crush] require crush-bundle failed", err);
}
