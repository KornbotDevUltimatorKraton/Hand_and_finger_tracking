#Project_name: Auto__live
#Creator: Roboreactor 
#Programmer: Mr.Chanapai Chuadchum  
import os 
import json 
import uvicorn 
import time 
from fastapi import FastAPI, WebSocket,APIRouter,Request, File, Form, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse,RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI() 
posstore = {} 
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/",response_class=HTMLResponse)
async def dataget(request:Request):
     
     return templates.TemplateResponse("index.html",{"request":request})    

if __name__ == "__main__":
      uvicorn_config = {
        "host": "0.0.0.0",  # Bind to all IP addresses
        "port": 8989,  # HTTPS port
        "reload": True,  # Enable auto-reload (set to False for production)
        "ssl_keyfile": "server.key",  # Path to your SSL private key file
        "ssl_certfile": "server.crt",  # Path to your SSL certificate file
        "log_level": "info",  # Logging level
        "root_path": "",  # Optional: Set a root path for the application
      }
      uvicorn.run("main:app",**uvicorn_config)
