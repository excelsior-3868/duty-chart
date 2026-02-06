
import requests
import json

_TRANS_CACHE = {}

def translate_to_nepali_batch(text_list):
    if not text_list:
        return {}
    
    to_translate = [t for t in text_list if t and t not in _TRANS_CACHE]
    if not to_translate:
        return {t: _TRANS_CACHE.get(t, t) for t in text_list}
    
    chunk_size = 30
    for i in range(0, len(to_translate), chunk_size):
        chunk = to_translate[i:i + chunk_size]
        combined = "\n".join(chunk)
        
        try:
            url = "https://translate.googleapis.com/translate_a/single"
            params = {
                "client": "gtx",
                "sl": "en",
                "tl": "ne",
                "dt": "t",
                "q": combined
            }
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                result = response.json()
                if result and result[0]:
                    translated_combined = "".join([part[0] for part in result[0] if part[0]])
                    translated_list = translated_combined.split("\n")
                    
                    print(f"Original chunk: {chunk}")
                    print(f"Translated chunk: {translated_list}")
                    
                    for orig, trans in zip(chunk, translated_list):
                        _TRANS_CACHE[orig] = trans.strip()
        except Exception as e:
            print(f"Batch translation error: {e}")
            
    return {t: _TRANS_CACHE.get(t, t) for t in text_list}

if __name__ == "__main__":
    names = ["Kiran Acharya", "Subin Bajracharya", "Prashant Adhikari"]
    results = translate_to_nepali_batch(names)
    print("\nResults:")
    for k, v in results.items():
        print(f"{k} -> {v}")
