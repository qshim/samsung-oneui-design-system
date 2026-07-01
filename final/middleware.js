import { NextResponse } from "next/server";

export function middleware(request) {
  // NOTE:
  // - Vercel/Edge 환경에서 middleware가 모든 경로에 적용되면 내부 경로까지 타면서
  //   예기치 않은 실패(MIDDLEWARE_INVOCATION_FAILED)가 발생할 수 있어 API 경로로 제한합니다.
  // - CORS가 필요할 때는 API 라우트에서만 처리하는 게 안전합니다.

  const origin = request.headers.get("origin") || "*";

  // Preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
