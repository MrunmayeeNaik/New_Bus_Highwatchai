import asyncio
import time
import sys
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"
CONCURRENT_REQUESTS = 20
BATCHES = 5
ENDPOINT = "/master/cities"

async def send_request(client: httpx.AsyncClient, req_id: int):
    start = time.perf_counter()
    try:
        resp = await client.get(f"{BASE_URL}{ENDPOINT}", timeout=10.0)
        latency = (time.perf_counter() - start) * 1000  # ms
        return resp.status_code, latency
    except Exception as e:
        latency = (time.perf_counter() - start) * 1000
        return None, latency

async def run_load_test():
    print(f"Starting load test on {BASE_URL}{ENDPOINT}...")
    print(f"Simulating {CONCURRENT_REQUESTS} concurrent users over {BATCHES} batches (Total 100 requests)...")
    
    # Verify server availability first
    try:
        with httpx.Client() as sync_client:
            res = sync_client.get(f"{BASE_URL}{ENDPOINT}", timeout=3.0)
            print(f"Health Check: Server responded with status {res.status_code}.")
    except Exception as e:
        print(f"CRITICAL: Health Check failed. Server might be offline. Error: {e}")
        print("Please start the backend server (uvicorn app.main:app --reload) before running the load test.")
        sys.exit(1)

    start_time = time.perf_counter()
    
    limits = httpx.Limits(max_keepalive_connections=CONCURRENT_REQUESTS + 5, max_connections=CONCURRENT_REQUESTS + 5)
    results = []
    
    async with httpx.AsyncClient(limits=limits) as client:
        for b in range(BATCHES):
            batch_start = time.perf_counter()
            tasks = [send_request(client, b * CONCURRENT_REQUESTS + i) for i in range(CONCURRENT_REQUESTS)]
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)
            # Short sleep between batches to let DB connections close/recycle
            await asyncio.sleep(0.1)
        
    end_time = time.perf_counter()
    total_duration = end_time - start_time
    
    # Process results
    success_count = 0
    failure_count = 0
    latencies = []
    
    for status, latency in results:
        latencies.append(latency)
        if status == 200:
            success_count += 1
        else:
            failure_count += 1
            
    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    min_latency = min(latencies) if latencies else 0
    max_latency = max(latencies) if latencies else 0
    requests_per_sec = len(results) / total_duration if total_duration > 0 else 0
    
    print("\n====================================================")
    print("PERFORMANCE LOAD TEST REPORT")
    print("====================================================")
    print(f"Total Requests:       {len(results)}")
    print(f"Successful Requests:  {success_count} ({(success_count/len(results)*100):.1f}%)")
    print(f"Failed Requests:      {failure_count} ({(failure_count/len(results)*100):.1f}%)")
    print(f"Total Duration:       {total_duration:.3f} seconds")
    print(f"Throughput:           {requests_per_sec:.2f} req/sec")
    print(f"Min Latency:          {min_latency:.2f} ms")
    print(f"Max Latency:          {max_latency:.2f} ms")
    print(f"Average Latency:      {avg_latency:.2f} ms")
    print("====================================================")

if __name__ == "__main__":
    asyncio.run(run_load_test())
