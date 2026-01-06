import os
import re

# Walk through Frontend directory
frontend_dir = r'c:\FSD@\FSD-ML\Frontend'

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith(('.html', '.js')):
            filepath = os.path.join(root, file)
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Track if changes were made
                original = content
                
                # Fix template literals that were created with single quotes
                # Replace '${window.location.origin} with `${window.location.origin}
                content = re.sub(r"'(\$\{window\.location\.origin\}[^']*)'", r'`\1`', content)
                
                # Fix WebSocket URLs with single quotes
                content = re.sub(r"'(\$\{window\.location\.protocol[^']*\})'", r'`\1`', content)
                
                # Write back if changed
                if content != original:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"✓ Fixed: {filepath}")
                    
            except Exception as e:
                print(f"✗ Error processing {filepath}: {e}")

print("\nDone!")
