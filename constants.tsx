
import { PythonFile } from './types';

export const PYTHON_FILES: PythonFile[] = [
  {
    name: 'browser.py',
    description: 'Core Selenium engine with Edge Driver support, headless mode, and resilience features.',
    content: `import time
import logging
from selenium import webdriver
from selenium.webdriver.edge.service import Service
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class RTBrowser:
    def __init__(self, driver_path=None, headless=True, disable_images=True):
        self.options = Options()
        if headless:
            self.options.add_argument("--headless")
        
        self.options.add_argument("--disable-gpu")
        self.options.add_argument("--ignore-certificate-errors")
        self.options.add_argument("--window-size=1920,1080")
        
        if disable_images:
            self.options.add_argument("--blink-settings=imagesEnabled=false")
        
        self.driver_path = driver_path
        self.driver = None
        self.init_driver()

    def init_driver(self):
        try:
            service = Service(executable_path=self.driver_path) if self.driver_path else Service()
            self.driver = webdriver.Edge(service=service, options=self.options)
            self.driver.set_page_load_timeout(30)
            logging.info("Browser initialized successfully.")
        except Exception as e:
            logging.error(f"Failed to initialize driver: {e}")
            raise

    def get_page(self, url, retries=3):
        for i in range(retries):
            try:
                self.driver.get(url)
                # Wait for document.readyState to be complete
                WebDriverWait(self.driver, 20).until(
                    lambda d: d.execute_script('return document.readyState') == 'complete'
                )
                self.scroll_page()
                return True
            except Exception as e:
                logging.warning(f"Attempt {i+1} failed for {url}: {e}")
                if i == retries - 1:
                    return False
                time.sleep(2)
        return False

    def scroll_page(self):
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight/2);")
        time.sleep(1)
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")

    def get_source(self):
        return self.driver.page_source

    def take_screenshot(self, filename):
        self.driver.save_screenshot(filename)

    def close(self):
        if self.driver:
            self.driver.quit()
`
  },
  {
    name: 'extractor.py',
    description: 'Specific logic for parsing RT Arabic article components.',
    content: `from bs4 import BeautifulSoup
import logging

class RTExtractor:
    @staticmethod
    def extract(html, url):
        soup = BeautifulSoup(html, 'html.parser')
        data = {
            "url": url,
            "title": "",
            "content": "",
            "date": "",
            "category": "",
            "image": "",
            "tags": []
        }
        
        try:
            # Title extraction
            title_tag = soup.find('h1', class_='article__heading')
            if title_tag:
                data["title"] = title_tag.get_text(strip=True)
            
            # Content extraction
            content_div = soup.find('div', class_='article__text')
            if content_div:
                paragraphs = content_div.find_all('p')
                data["content"] = "\\n".join([p.get_text(strip=True) for p in paragraphs])
            
            # Date
            date_tag = soup.find('time', class_='article__date')
            if date_tag:
                data["date"] = date_tag.get_text(strip=True)
            
            # Category
            cat_tag = soup.find('a', class_='article__category')
            if cat_tag:
                data["category"] = cat_tag.get_text(strip=True)
            
            # Main Image
            img_tag = soup.find('img', class_='article__image')
            if img_tag:
                data["image"] = img_tag.get('src')
            
            # Tags
            tags_container = soup.find('div', class_='article__tags')
            if tags_container:
                data["tags"] = [t.get_text(strip=True) for t in tags_container.find_all('a')]
                
        except Exception as e:
            logging.error(f"Extraction error: {e}")
            
        return data
`
  },
  {
    name: 'database.py',
    description: 'SQLite persistence layer with thread-safe connection handling.',
    content: `import sqlite3
import logging

class RTDatabase:
    def __init__(self, db_name="news.db"):
        self.db_name = db_name
        self.init_db()

    def get_connection(self):
        return sqlite3.connect(self.db_name)

    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS news (
                id INTEGER PRIMARY KEY AUTO_INCREMENT,
                url TEXT UNIQUE,
                title TEXT,
                content TEXT,
                date TEXT,
                category TEXT,
                image TEXT,
                raw_html TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()

    def insert_or_update(self, data, raw_html=""):
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO news (url, title, content, date, category, image, raw_html)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (data['url'], data['title'], data['content'], data['date'], data['category'], data['image'], raw_html))
            conn.commit()
            return True
        except Exception as e:
            logging.error(f"DB Error: {e}")
            return False
        finally:
            conn.close()

    def get_latest(self, limit=10):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM news ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        return rows
`
  },
  {
    name: 'api.py',
    description: 'Flask-based REST API for remote scraper control and data retrieval.',
    content: `from flask import Flask, request, jsonify
from browser import RTBrowser
from extractor import RTExtractor
from database import RTDatabase

app = Flask(__name__)
db = RTDatabase()

@app.route('/fetch', methods=['GET'])
def fetch_url():
    url = request.args.get('url')
    if not url:
        return jsonify({"error": "URL parameter missing"}), 400
    
    browser = RTBrowser(headless=True)
    success = browser.get_page(url)
    if success:
        html = browser.get_source()
        data = RTExtractor.extract(html, url)
        db.insert_or_update(data, html)
        browser.close()
        return jsonify(data)
    else:
        browser.close()
        return jsonify({"error": "Failed to load page"}), 500

@app.route('/get', methods=['GET'])
def get_news():
    news_id = request.args.get('id')
    # ... logic to fetch by ID ...
    return jsonify({"status": "not implemented in snippet"})

if __name__ == "__main__":
    app.run(port=5000)
`
  },
  {
    name: 'main.py',
    description: 'CLI entry point for manual scraping tasks and automation.',
    content: `import sys
import logging
from browser import RTBrowser
from extractor import RTExtractor
from database import RTDatabase

def run_scraper(url):
    logging.basicConfig(level=logging.INFO)
    print(f"[*] Starting RT Intelligence Browser for: {url}")
    
    db = RTDatabase()
    browser = RTBrowser(headless=True)
    
    if browser.get_page(url):
        print("[+] Page loaded successfully.")
        html = browser.get_source()
        data = RTExtractor.extract(html, url)
        
        print(f"[+] Extracted: {data['title']}")
        if db.insert_or_update(data, html):
            print("[+] Data saved to SQLite database.")
        else:
            print("[-] Database save failed.")
    else:
        print("[-] Failed to load target URL.")
        
    browser.close()

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "https://arabic.rt.com/world/"
    run_scraper(target)
`
  }
];

export const REQUIREMENTS = `selenium>=4.10.0
beautifulsoup4>=4.12.0
flask>=2.3.0
requests>=2.31.0
`;
