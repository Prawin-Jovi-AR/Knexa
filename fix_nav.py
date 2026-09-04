import re
import os

files = ['dashboard.html', 'discover.html', 'feed.html', 'matches.html', 'profile.html', 'skill-dna.html']

for f in files:
    path = os.path.join('f:/Knexa', f)
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
        
    # The current structure is:
    # <div class="nav-links" id="nav-menu">...</div>
    # <div class="nav-actions">...</div>
    # Sometimes followed by <div class="hamburger"...
    
    # We want to replace everything from <div class="nav-links"... to the end of the <nav> block
    # and construct the standardized nav.
    
    # Let's extract the contents of nav-links and nav-actions.
    nav_links_match = re.search(r'<div class="nav-links"[^>]*>([\s\S]*?)</div>\s*<div class="nav-actions">', content)
    nav_actions_match = re.search(r'<div class="nav-actions">([\s\S]*?)</div>\s*(?:</div>|</nav>|<div class="hamburger")', content)
    
    if not nav_links_match or not nav_actions_match:
        print(f"Could not parse {f}")
        continue
        
    nav_links_content = nav_links_match.group(1)
    nav_actions_content = nav_actions_match.group(1)
    
    # Build replacement
    new_nav = f'''<div class="nav-menu" id="nav-menu">
            <div class="nav-links">
{nav_links_content}            </div>
            <div class="nav-actions">
{nav_actions_content}            </div>
        </div>
        <button class="hamburger" id="hamburger" aria-label="Menu">
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
        </button>
    </div>
</nav>'''

    # Find where to replace. We replace from <div class="nav-links"... to </nav>
    # Wait, the opening is: <div class="nav-links" id="nav-menu">
    new_content = re.sub(r'<div class="nav-links"[^>]*>[\s\S]*?</nav>', new_nav, content)
    
    with open(path, 'w', encoding='utf-8') as file:
        file.write(new_content)
    print(f"Updated {f}")
