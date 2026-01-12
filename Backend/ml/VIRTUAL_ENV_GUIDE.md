# Virtual Environment Setup Guide

## Why Use a Virtual Environment?

A Python virtual environment:
- **Isolates dependencies** - Prevents conflicts with global packages
- **Version control** - Each project can have different package versions
- **Clean installs** - Easy to recreate if something breaks
- **Best practice** - Standard for Python development

---

## Quick Setup

### Option 1: Automated (Recommended)

Run the setup script from the project root:

```powershell
.\setup-recommendations.ps1
```

This will automatically:
1. Create a virtual environment at `Backend/ml/venv/`
2. Activate it
3. Install all dependencies
4. Configure everything for you

---

### Option 2: Manual Setup

#### Windows (PowerShell)

```powershell
# Navigate to the ml directory
cd Backend\ml

# Create virtual environment
python -m venv venv

# Activate it
.\venv\Scripts\Activate.ps1

# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

#### Windows (CMD)

```cmd
cd Backend\ml
python -m venv venv
venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
```

#### Linux/Mac

```bash
cd Backend/ml
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

## Using the Virtual Environment

### Activate

**PowerShell:**
```powershell
cd Backend\ml
.\venv\Scripts\Activate.ps1
```

**CMD:**
```cmd
cd Backend\ml
venv\Scripts\activate.bat
```

**Linux/Mac:**
```bash
cd Backend/ml
source venv/bin/activate
```

You'll see `(venv)` in your terminal prompt when activated.

### Deactivate

Simply run:
```bash
deactivate
```

---

## Working with the Virtual Environment

### Install New Packages

```powershell
# Activate first
.\venv\Scripts\Activate.ps1

# Install package
pip install package-name

# Update requirements.txt
pip freeze > requirements.txt
```

### Verify Installation

```powershell
# Check Python location (should be in venv)
python -c "import sys; print(sys.executable)"

# List installed packages
pip list

# Check specific package
pip show numpy
```

---

## Running Python Scripts

### Always activate the virtual environment first:

```powershell
cd Backend\ml
.\venv\Scripts\Activate.ps1
python api/recommendation_api.py --action status --params "{}"
```

### Node.js Integration

The recommendation service automatically uses the virtual environment Python:

```javascript
// In recommendationService.js
// The spawn will use system Python, which should call the venv
// Make sure to activate venv when testing manually
```

**Note:** When running via Node.js, you may need to update the Python path in `recommendationService.js` to use the virtual environment Python explicitly.

---

## Updating the Virtual Environment

### Update All Packages

```powershell
.\venv\Scripts\Activate.ps1
pip install --upgrade -r requirements.txt
```

### Recreate from Scratch

```powershell
# Remove old environment
Remove-Item -Recurse -Force venv

# Create new one
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## Troubleshooting

### "Activate.ps1 cannot be loaded"

PowerShell execution policy issue. Run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then try activating again.

### "Python not found" after activation

Make sure you're in the correct directory:

```powershell
cd Backend\ml
.\venv\Scripts\Activate.ps1
python --version  # Should show your Python version
```

### Packages not found when running scripts

1. Ensure virtual environment is activated
2. Check you installed requirements:
   ```powershell
   pip list
   ```
3. Reinstall if needed:
   ```powershell
   pip install -r requirements.txt
   ```

### Node.js can't find Python packages

Update `Backend/services/recommendationService.js` to use venv Python:

```javascript
callPythonScript(action, params) {
    const venvPython = path.join(__dirname, '../ml/venv/Scripts/python.exe');
    const pythonCommand = fs.existsSync(venvPython) ? venvPython : 'python';
    
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn(pythonCommand, [
            this.pythonScriptPath,
            '--action', action,
            '--params', JSON.stringify(params)
        ]);
        // ... rest of code
    });
}
```

---

## Best Practices

### ✅ Do's

- ✅ Always activate venv before working with Python
- ✅ Add `venv/` to `.gitignore` (already done)
- ✅ Keep `requirements.txt` updated
- ✅ Use `pip freeze > requirements.txt` after installing new packages
- ✅ Document any manual dependency changes

### ❌ Don'ts

- ❌ Don't commit the `venv/` folder to Git
- ❌ Don't install packages globally when working on this project
- ❌ Don't mix system Python and venv Python
- ❌ Don't forget to activate before running Python commands

---

## Git Configuration

The `.gitignore` should already include:

```gitignore
# Python virtual environment
venv/
env/
.venv/

# Python cache
__pycache__/
*.pyc
*.pyo
```

---

## VS Code Integration

Add to `.vscode/settings.json`:

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/Backend/ml/venv/Scripts/python.exe",
  "python.terminal.activateEnvironment": true
}
```

This will automatically use the virtual environment in VS Code.

---

## Quick Reference

| Task | Command (PowerShell) |
|------|---------------------|
| Create venv | `python -m venv venv` |
| Activate | `.\venv\Scripts\Activate.ps1` |
| Deactivate | `deactivate` |
| Install deps | `pip install -r requirements.txt` |
| Update deps | `pip install --upgrade -r requirements.txt` |
| List packages | `pip list` |
| Freeze deps | `pip freeze > requirements.txt` |
| Delete venv | `Remove-Item -Recurse -Force venv` |

---

## Summary

Using a virtual environment:
- ✅ Prevents global package conflicts
- ✅ Makes project dependencies explicit
- ✅ Ensures reproducible installations
- ✅ Follows Python best practices

**Always activate the virtual environment before working with Python in this project!**
