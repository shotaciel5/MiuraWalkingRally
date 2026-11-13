"""Export the deck with Microsoft PowerPoint and check text bounds.
Windows / desktop PowerPoint required. Opens the deck without a document window.
"""
from pathlib import Path
import json, time
import win32com.client
from PIL import Image, ImageOps, ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
PREVIEW=ROOT/".tools/presentation-preview"
PREVIEW.mkdir(parents=True,exist_ok=True)
pptx=HERE/"三浦市ウォーキングラリー_審査資料_10枚.pptx"
pdf=pptx.with_suffix(".pdf")
app=win32com.client.DispatchEx("PowerPoint.Application")
presentation=None
issues=[]
try:
    app.DisplayAlerts=1
    presentation=app.Presentations.Open(str(pptx),ReadOnly=True,Untitled=False,WithWindow=False)
    if presentation.Slides.Count!=10:raise AssertionError("Exactly ten slides are required")
    for i in range(1,11):
        slide=presentation.Slides(i)
        for j in range(1,slide.Shapes.Count+1):
            sh=slide.Shapes(j)
            if sh.HasTextFrame and sh.TextFrame.HasText:
                tf=sh.TextFrame2
                bh=float(tf.TextRange.BoundHeight)
                bw=float(tf.TextRange.BoundWidth)
                available_h=float(sh.Height)-float(tf.MarginTop)-float(tf.MarginBottom)
                available_w=float(sh.Width)-float(tf.MarginLeft)-float(tf.MarginRight)
                if bh>available_h+1.5 or bw>available_w+2:
                    issues.append(dict(slide=i,name=sh.Name,text=sh.TextFrame.TextRange.Text,
                                       boundHeight=round(bh,2),height=round(available_h,2),
                                       boundWidth=round(bw,2),width=round(available_w,2)))
        slide.Export(str(PREVIEW/f"slide-{i:02d}.png"),"PNG",1920,1080)
    presentation.SaveAs(str(pdf),32)
finally:
    if presentation is not None:presentation.Close()
    if app.Presentations.Count==0:app.Quit()

sheet=Image.new("RGB",(1440,5*430),(226,234,236))
draw=ImageDraw.Draw(sheet)
for i in range(1,11):
    im=Image.open(PREVIEW/f"slide-{i:02d}.png").convert("RGB")
    im.thumbnail((700,394))
    col=(i-1)%2;row=(i-1)//2
    x=10+col*720;y=24+row*430
    sheet.paste(im,(x,y))
    draw.text((x+3,y-18),f"{i:02d}",fill=(32,55,68))
sheet.save(PREVIEW/"contact-sheet.jpg",quality=94)
report=dict(slides=10,pdf=str(pdf),renderer="Microsoft PowerPoint",textBoundsIssues=issues,previewDir=str(PREVIEW))
(PREVIEW/"render-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report,ensure_ascii=False))
