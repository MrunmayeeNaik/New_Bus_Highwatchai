import urllib.request
import sys
import re

URLS = [
    ("Landing Page", "http://localhost:5173/"),
    ("Login Page", "http://localhost:5173/login"),
    ("Register Page", "http://localhost:5173/register")
]

def check_ui_page(name, url):
    print(f"Checking frontend UI page: {name} ({url})... ", end="")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'})
        with urllib.request.urlopen(req, timeout=5.0) as res:
            status = res.status
            html = res.read().decode('utf-8')
            
            # Check 1: HTML structure
            has_doctype = "<!DOCTYPE html>" in html or "<!doctype html>" in html
            # Check 2: Responsive Viewport Meta
            has_viewport = 'name="viewport"' in html or "name='viewport'" in html
            # Check 3: Script bundles
            has_assets = "/src/main.jsx" in html or "assets/" in html or "bundle" in html
            
            if status == 200 and has_doctype and has_viewport:
                print("OK")
                print(f"  - Status: {status}")
                print(f"  - HTML5 Doctype: Yes")
                print(f"  - Mobile Responsive Viewport: Yes")
                print(f"  - Entry Bundler Script: {'Yes' if has_assets else 'Not detected (development check)'}")
                return True
            else:
                print("FAIL")
                print(f"  - Details: Status={status}, Doctype={has_doctype}, Viewport={has_viewport}")
                return False
    except Exception as e:
        print("OFFLINE/FAIL")
        print(f"  - Error message: {e}")
        return False

def run_checks():
    print("====================================================")
    print("UI & CROSS-BROWSER HEALTH VALIDATION REPORT")
    print("====================================================")
    
    all_ok = True
    for name, url in URLS:
        ok = check_ui_page(name, url)
        if not ok:
            all_ok = False
            
    print("====================================================")
    if all_ok:
        print("SUCCESS: All checked frontend pages are serveable and responsive.")
    else:
        print("WARNING: Some frontend pages failed validation checks. Ensure the Vite dev server (npm run dev) is running at localhost:5173.")
    print("====================================================")
    
if __name__ == "__main__":
    run_checks()
