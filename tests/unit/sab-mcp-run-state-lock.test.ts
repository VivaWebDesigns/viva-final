import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inSabRunStateQueue } from "../../server/features/sab-mcp/runState";
const database = vi.hoisted(() => ({transaction: vi.fn(), execute: vi.fn()}));
vi.mock("../../server/db",()=>({db:{transaction:database.transaction}}));
beforeEach(()=>{
  vi.clearAllMocks();
  database.execute.mockResolvedValue(undefined);
  database.transaction.mockImplementation(async work=>work({execute:database.execute}));
});
afterEach(()=>vi.unstubAllEnvs());

describe("SAB production run-state lock",()=>{
  it("holds the database transaction lock across the whole protected operation",async()=>{
    vi.stubEnv("NODE_ENV","production");
    const ordering:string[]=[];
    database.execute.mockImplementation(async()=>{ordering.push("lock");});
    database.transaction.mockImplementation(async work=>{
      ordering.push("transaction");const result=await work({execute:database.execute});ordering.push("commit");return result;
    });
    const result=await inSabRunStateQueue(async()=>{ordering.push("provider-and-persistence");return "receipt";});
    expect(result).toBe("receipt");
    expect(ordering).toEqual(["transaction","lock","provider-and-persistence","commit"]);
  });
  it("fails closed before the provider call when the shared database lock cannot be acquired",async()=>{
    vi.stubEnv("NODE_ENV","production");
    database.execute.mockRejectedValue(new Error("database unavailable"));
    const provider=vi.fn();
    await expect(inSabRunStateQueue(provider)).rejects.toThrow("database unavailable");
    expect(provider).not.toHaveBeenCalled();
  });
  it("releases the local queue after a failed transaction and still obtains the next shared lock",async()=>{
    vi.stubEnv("NODE_ENV","production");
    database.execute.mockRejectedValueOnce(new Error("lock failed"));
    await expect(inSabRunStateQueue(async()=>"never")).rejects.toThrow("lock failed");
    await expect(inSabRunStateQueue(async()=>"next")).resolves.toBe("next");
    expect(database.execute).toHaveBeenCalledTimes(2);
  });
  it("keeps nonproduction tests independent of database credentials",async()=>{
    vi.stubEnv("NODE_ENV","test");
    await expect(inSabRunStateQueue(async()=>"test" )).resolves.toBe("test");
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
