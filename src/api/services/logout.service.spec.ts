import { describe, it, expect, vi, beforeEach } from "vitest";
import { LogoutService } from "./logout.service";
import { JWTTokenService } from "./jwt-token.service";
import { db } from "../db";
import { sessions } from "../db/schema";
import { eq } from "drizzle-orm";

// Mocks
vi.mock("../db", () => ({
    db: {
        delete: vi.fn(() => ({
            where: vi.fn(),
        })),
    },
}));

vi.mock("./jwt-token.service", () => ({
    JWTTokenService: {
        verifyToken: vi.fn(),
    },
}));

describe("LogoutService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should successfully logout with valid token and sessionId", async () => {
        const mockToken = "valid.token.here";
        const mockPayload = { sessionId: "session-123" };
        (JWTTokenService.verifyToken as any).mockResolvedValue(mockPayload);

        // Setup db deleted mock
        const mockWhere = vi.fn();
        (db.delete as any).mockReturnValue({ where: mockWhere });

        await LogoutService.logout(mockToken);

        expect(JWTTokenService.verifyToken).toHaveBeenCalledWith(mockToken);
        expect(db.delete).toHaveBeenCalledWith(sessions);
        // We can't easily check 'where' arguments with this mock setup unless we dig deeper, 
        // but we verified delete was called on sessions table.
    });

    it("should return success (idempotent) if token is missing", async () => {
        await LogoutService.logout(undefined);
        expect(JWTTokenService.verifyToken).not.toHaveBeenCalled();
        expect(db.delete).not.toHaveBeenCalled();
    });

    it("should return success (idempotent) if token is invalid/expired", async () => {
        const mockToken = "invalid.token";
        (JWTTokenService.verifyToken as any).mockResolvedValue(null);

        await LogoutService.logout(mockToken);

        expect(JWTTokenService.verifyToken).toHaveBeenCalledWith(mockToken);
        expect(db.delete).not.toHaveBeenCalled();
    });

    // Note: if payload has no sessionId, we expect no delete call
    it("should do nothing if payload lacks sessionId", async () => {
        const mockToken = "valid.token.no.session";
        (JWTTokenService.verifyToken as any).mockResolvedValue({ userId: "user-1" }); // No sessionId

        await LogoutService.logout(mockToken);

        expect(JWTTokenService.verifyToken).toHaveBeenCalled();
        expect(db.delete).not.toHaveBeenCalled();
    });
});
