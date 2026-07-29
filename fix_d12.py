import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('hexmap.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = """          // Use d12 result for display only
          const d12val = result2.total;
          showStepResult('\U0001F3B2', `\u62bd\u4e2d \u2192 ${ticon} ${tname}`, '', `d12\u793a\u6570:${d12val}`);"""

new = """          showStepResult('\U0001F3B2', `\u62bd\u4e2d \u2192 ${ticon} ${tname}`, '', `${dieFormula}\u793a\u6570:${result2.total}`);"""

if old in content:
    content = content.replace(old, new)
    with open('hexmap.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed!')
else:
    print('Pattern not found')
    # Show exact content
    idx = content.find('d12val')
    if idx >= 0:
        print(repr(content[idx-50:idx+50]))
    else:
        print('d12val not found at all')
        idx2 = content.find('d12\u793a\u6570')
        if idx2 >= 0:
            print('d12 display found at', idx2)
            print(repr(content[idx2-50:idx2+50]))