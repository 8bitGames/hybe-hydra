import re

# Read the file
with open('app/(dashboard)/create/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern 1: Select Campaign
old1 = '''<Label className="text-sm font-medium text-neutral-700">
                  {t.selectCampaign}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                      <Info className="h-3 w-3 text-neutral-600" />
                    </button>
                  </PopoverTrigger>'''

new1 = '''<Popover>
                  <PopoverTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-pointer">
                      <Label className="text-sm font-medium text-neutral-700 cursor-pointer">
                        {t.selectCampaign}
                      </Label>
                      <div className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                        <Info className="h-3 w-3 text-neutral-600" />
                      </div>
                    </div>
                  </PopoverTrigger>'''

content = content.replace(old1, new1)

# Pattern 2: Choose Creation Method
old2 = '''<Label className="text-sm font-medium text-neutral-700">
                  {language === "ko" ? "생성 방식 선택" : "Choose Creation Method"}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                      <Info className="h-3 w-3 text-neutral-600" />
                    </button>
                  </PopoverTrigger>'''

new2 = '''<Popover>
                  <PopoverTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-pointer">
                      <Label className="text-sm font-medium text-neutral-700 cursor-pointer">
                        {language === "ko" ? "생성 방식 선택" : "Choose Creation Method"}
                      </Label>
                      <div className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                        <Info className="h-3 w-3 text-neutral-600" />
                      </div>
                    </div>
                  </PopoverTrigger>'''

content = content.replace(old2, new2)

# Pattern 3: Select Assets
old3 = '''<Label className="text-sm font-medium text-neutral-700">
                  {language === "ko" ? "에셋 선택" : "Select Assets"}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                      <Info className="h-3 w-3 text-neutral-600" />
                    </button>
                  </PopoverTrigger>'''

new3 = '''<Popover>
                  <PopoverTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-pointer">
                      <Label className="text-sm font-medium text-neutral-700 cursor-pointer">
                        {language === "ko" ? "에셋 선택" : "Select Assets"}
                      </Label>
                      <div className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                        <Info className="h-3 w-3 text-neutral-600" />
                      </div>
                    </div>
                  </PopoverTrigger>'''

content = content.replace(old3, new3)

# Write the file
with open('app/(dashboard)/create/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated create/page.tsx')
