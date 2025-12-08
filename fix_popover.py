import re

# Read the file
with open('app/(dashboard)/analyze/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern 3: Target Audience
old3 = '''<div className="flex items-center gap-1.5 mb-2">
                  <Label className="text-xs font-medium text-neutral-700">
                    {t.targetAudience}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                        <Info className="h-3 w-3 text-neutral-600" />
                      </button>
                    </PopoverTrigger>'''

new3 = '''<Popover>
                  <PopoverTrigger asChild>
                    <div className="flex items-center gap-1.5 mb-2 cursor-pointer">
                      <Label className="text-xs font-medium text-neutral-700 cursor-pointer">
                        {t.targetAudience}
                      </Label>
                      <div className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                        <Info className="h-3 w-3 text-neutral-600" />
                      </div>
                    </div>
                  </PopoverTrigger>'''

content = content.replace(old3, new3)

# Fix closing div for Target Audience
old3_close = '''</PopoverContent>
                  </Popover>
                </div>
                <Input'''

new3_close = '''</PopoverContent>
                </Popover>
                <Input'''

content = content.replace(old3_close, new3_close)

# Pattern 4: Content Goals
old4 = '''<div className="flex items-center gap-1.5 mb-2">
                  <Label className="text-xs font-medium text-neutral-700">
                    {t.contentGoals}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                        <Info className="h-3 w-3 text-neutral-600" />
                      </button>
                    </PopoverTrigger>'''

new4 = '''<Popover>
                  <PopoverTrigger asChild>
                    <div className="flex items-center gap-1.5 mb-2 cursor-pointer">
                      <Label className="text-xs font-medium text-neutral-700 cursor-pointer">
                        {t.contentGoals}
                      </Label>
                      <div className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                        <Info className="h-3 w-3 text-neutral-600" />
                      </div>
                    </div>
                  </PopoverTrigger>'''

content = content.replace(old4, new4)

# Fix closing div for Content Goals
old4_close = '''</PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-wrap gap-2">'''

new4_close = '''</PopoverContent>
                </Popover>
                <div className="flex flex-wrap gap-2">'''

content = content.replace(old4_close, new4_close)

# Pattern 5: AI Ideas
old5 = '''<div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-neutral-900" />
                {t.aiIdeas}
              </h2>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                    <Info className="h-3 w-3 text-neutral-600" />
                  </button>
                </PopoverTrigger>'''

new5 = '''<Popover>
              <PopoverTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer">
                  <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-neutral-900" />
                    {t.aiIdeas}
                  </h2>
                  <div className="p-0.5 rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors">
                    <Info className="h-3 w-3 text-neutral-600" />
                  </div>
                </div>
              </PopoverTrigger>'''

content = content.replace(old5, new5)

# Fix closing for AI Ideas
old5_close = '''</PopoverContent>
              </Popover>
            </div>
          </div>

          <ScrollArea'''

new5_close = '''</PopoverContent>
            </Popover>
          </div>

          <ScrollArea'''

content = content.replace(old5_close, new5_close)

# Write the file
with open('app/(dashboard)/analyze/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated remaining sections in analyze/page.tsx')
