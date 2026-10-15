/**
 * 二维码提示文案的「打开环境」判定：小程序 web-view / 微信浏览器 H5 / 手机浏览器 / 电脑浏览器。
 * 同一张小程序码在几种环境里的正确操作不同（长按识别 / 微信扫一扫 / 手机微信扫一扫），
 * 由调用方按环境取对应文案；微信浏览器 H5 可走服务号 OAuth + JSAPI 直付，不必扫码。
 */
import { useEffect, useState } from "react";
import { detectMiniProgramEnv, isMiniProgramEnv } from "@/lib/mp-bridge";

export type QrEnv = "mp" | "wechat-h5" | "mobile" | "desktop";

/** 同步判定：小程序标识 → 微信浏览器 → 手机 UA → 电脑 */
export function detectQrEnv(): QrEnv {
  if (typeof navigator === "undefined") return "desktop";
  if (isMiniProgramEnv()) return "mp";
  if (/MicroMessenger/i.test(navigator.userAgent)) return "wechat-h5";
  return /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

/**
 * 首帧固定按 desktop 渲染（服务端与首屏一致，不产生水合不一致），挂载后立即校正；
 * 再用 detectMiniProgramEnv() 兜底 iOS 上 UA 不带 miniProgram 标识的情况
 * （JSSDK 只在微信内加载，普通浏览器不碰）。
 */
export function useQrEnv(): QrEnv {
  const [env, setEnv] = useState<QrEnv>("desktop");
  useEffect(() => {
    setEnv(detectQrEnv());
    detectMiniProgramEnv().then((yes) => {
      if (yes) setEnv("mp");
    });
  }, []);
  return env;
}
