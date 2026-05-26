import requests

def test_provided_sms():
    url = "http://10.26.192.122:42399/updatedsmssender-1.0-SNAPSHOT/updatedsmssender/"
    params = {
        "username": "NtcSmsSender",
        "password": ">xfhT4:/W^6YyY,M",
        "cellNo": "9851129935",
        "message": "Test from Duty Chart System",
        "encoding": "E",
        "systemId": "1"
    }
    
    print(f"Testing SMS Gateway: {url}")
    print(f"Parameters: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Full URL: {response.url}")
        print(f"Status Code: {response.status_code}")
        print(f"Raw Response: {response.text}")
        
        if response.status_code == 200:
            print("SUCCESS: Request accepted by gateway.")
        else:
            print(f"FAILED: Gateway returned non-200 status.")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    test_provided_sms()
