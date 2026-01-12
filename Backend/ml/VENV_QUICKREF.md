# Quick Reference - Virtual Environment

## 🚀 First Time Setup

```powershell
# From project root - Run once
.\setup-recommendations.ps1
```

---

## 💻 Daily Usage

### Activate Virtual Environment

```powershell
# PowerShell
cd Backend\ml
.\venv\Scripts\Activate.ps1

# CMD
cd Backend\ml
venv\Scripts\activate.bat

# Linux/Mac
cd Backend/ml
source venv/bin/activate
```

**You'll see `(venv)` in your prompt when active**

### Deactivate

```bash
deactivate
```

---

## 📦 Common Commands

```powershell
# Install new package
pip install package-name

# Update requirements.txt
pip freeze > requirements.txt

# List installed packages
pip list

# Check Python location
python -c "import sys; print(sys.executable)"

# Reinstall all dependencies
pip install -r requirements.txt
```

---

## ✅ Before You Code

**Always check:**
1. Is virtual environment activated? → See `(venv)` in prompt
2. In correct directory? → `Backend/ml`
3. Dependencies installed? → `pip list`

---

## 🔧 Troubleshooting

### "Cannot load Activate.ps1"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Package not found"
```powershell
# Make sure venv is activated
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### "Python not using venv"
```powershell
# Check Python path
python -c "import sys; print(sys.executable)"
# Should show: ...\Backend\ml\venv\Scripts\python.exe
```

---

## 📝 Cheat Sheet

| Action | Command |
|--------|---------|
| **Setup** | `.\setup-recommendations.ps1` |
| **Activate** | `.\venv\Scripts\Activate.ps1` |
| **Deactivate** | `deactivate` |
| **Install** | `pip install -r requirements.txt` |
| **Update** | `pip install --upgrade -r requirements.txt` |
| **List** | `pip list` |

---

## 🎯 Remember

- ✅ **Always activate** before Python work
- ✅ **Don't commit** venv/ to Git  
- ✅ **Keep requirements.txt** updated
- ✅ **Use venv** for isolation

**Full Guide:** See [VIRTUAL_ENV_GUIDE.md](VIRTUAL_ENV_GUIDE.md)
