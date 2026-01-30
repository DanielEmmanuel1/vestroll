import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { LogoutService } from "@/api/services/logout.service";
import { ApiResponse } from "@/api/utils/api-response";
import { AuthUtils } from "@/api/utils/auth";
import { AppError } from "@/api/utils/errors";
import { logoutSchema } from "@/api/validations/auth-logout.schema";

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const cookieToken = cookieStore.get("refreshToken")?.value;

        let refreshToken = cookieToken;

        // Idempotent: If no token in cookie, we might check body (but spec says Input From HTTP-only cookie mainly)
        // "Read cookie ... Zod validation ... If token exists: ..."
        // The Input section "From HTTP-only cookie: refreshToken" implies that's the primary source.
        // However, we should be robust.
        // Spec says: "From HTTP-only cookie". It doesn't explicitly forbide body, but implies cookie.

        // Validate with Zod (even if undefined, schema handles optional)
        const validation = logoutSchema.safeParse({ refreshToken });

        if (validation.success && validation.data.refreshToken) {
            refreshToken = validation.data.refreshToken;
        }

        const ipAddress = AuthUtils.getClientIp(request);
        const userAgent = AuthUtils.getUserAgent(request);

        // Call service (Handles logic)
        await LogoutService.logout(refreshToken, { userAgent, ipAddress });

        // Always clear cookie
        const response = ApiResponse.success({ message: "Logged out successfully" });
        response.cookies.delete("refreshToken");

        return response;

    } catch (error) {
        // 500 only for internal errors
        if (error instanceof AppError) {
            // Should catch LogoutError/InternalLogoutError
            if (error.statusCode === 500) {
                return ApiResponse.error(error.message, 500);
            }
        }
        console.error("Logout route error:", error);
        return ApiResponse.error("Internal server error", 500);
    }
}
