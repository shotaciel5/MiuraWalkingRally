"""Build the ten-slide, editable hackathon reading deck.
No network calls, database access, or application changes.
"""
from __future__ import annotations
import json, math, hashlib, shutil
from pathlib import Path
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import MSO_AUTO_SIZE, MSO_ANCHOR, PP_ALIGN
from pptx.oxml.xmlchemy import OxmlElement

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ASSETS = HERE / "assets"
OUT = HERE / "三浦市ウォーキングラリー_審査資料_10枚.pptx"
W, H = 16.0, 9.0
C = dict(ink="203744", blue="174B66", coral="BF523B", ivory="FAF7F0",
         mist="E5EFF1", pale="F0F4F2", white="FFFFFF", gray="647B86",
         line="CEDDE1", lightblue="B4C6CF", sand="F1E4D0", gold="AD813F")
FONT = "Yu Gothic"
prs = Presentation()
prs.slide_width, prs.slide_height = Inches(W), Inches(H)
prs.core_properties.title = "三浦市ウォーキングラリー｜まぐろを食べた、その先へ。"
prs.core_properties.subject = "AI実装コンテスト・10枚の審査用資料"
prs.core_properties.author = "三浦市ウォーキングラリー 開発チーム"
prs.core_properties.keywords = "三浦市, コマ地図, 徒歩周遊, コース生成, AI, 読む資料"
prs.core_properties.comments = "2026-11-14。実装済みと期待効果・今後の検証を区別。"
audit = []
used_images = set()

def rgb(value):
    return RGBColor.from_string(C.get(value, value))

def shape(sl, kind, x, y, w, h, fill="white", line=None, radius=False):
    s = sl.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid(); s.fill.fore_color.rgb = rgb(fill)
    s._element.spPr.append(OxmlElement("a:effectLst"))
    if line:
        s.line.color.rgb = rgb(line); s.line.width = Pt(0.8)
    else: s.line.fill.background()
    if kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        try: s.adjustments[0] = 0.12
        except (IndexError, AttributeError): pass
    return s

def box(sl, x,y,w,h,fill="white",line=None):
    return shape(sl,MSO_SHAPE.ROUNDED_RECTANGLE,x,y,w,h,fill,line)

def text(sl, value, x,y,w,h, size=18, color="ink", bold=False,
         align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, spacing=1.19, name=""):
    s = sl.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    s.name = name or ("Text " + value.replace("\n"," ")[:38])
    tf = s.text_frame
    tf.clear(); tf.word_wrap = True; tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = valign
    for i, line in enumerate(value.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line; p.alignment = align; p.line_spacing = spacing
        p.space_before = p.space_after = Pt(0)
        p.font.name = FONT; p.font.size = Pt(size); p.font.bold = bold
        p.font.color.rgb = rgb(color)
        for run in p.runs:
            run.font.name=FONT; run.font.size=Pt(size); run.font.bold=bold
            run.font.color.rgb=rgb(color)
            rp=run._r.get_or_add_rPr()
            ea=OxmlElement("a:ea");ea.set("typeface",FONT);rp.append(ea)
            rp.set("lang","ja-JP")
    return s

def line(sl,x1,y1,x2,y2,color="line",width=1):
    s=sl.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1),
                              Inches(x2), Inches(y2))
    s.line.color.rgb=rgb(color);s.line.width=Pt(width)
    s._element.spPr.append(OxmlElement("a:effectLst"))
    s.line._get_or_add_ln().set("cap","rnd")
    return s

def arrow(sl,x1,y1,x2,y2,color="blue",width=2.2):
    s=line(sl,x1,y1,x2,y2,color,width)
    ln=s.line._get_or_add_ln()
    tail=OxmlElement("a:tailEnd");tail.set("type","triangle");tail.set("w","sm");tail.set("len","sm");ln.append(tail)
    return s

def pill(sl,label,x,y,w,fill="mist",color="blue",size=12):
    box(sl,x,y,w,0.35,fill)
    text(sl,label,x+0.10,y+0.045,w-0.20,0.24,size,color,True,PP_ALIGN.CENTER)

def picture(sl, path, x,y,w,h, focus=(0.5,0.5), region=None):
    path=Path(path)
    if not path.exists(): raise FileNotFoundError(path)
    used_images.add(path)
    iw,ih=Image.open(path).size
    if region is None: rx,ry,rw,rh=0,0,iw,ih
    else: rx,ry,rw,rh=region
    ratio=(rw/rh)/(w/h)
    if ratio>1:
        nw=rw/ratio;rx+=(rw-nw)*focus[0];rw=nw
    else:
        nh=rh*ratio;ry+=(rh-nh)*focus[1];rh=nh
    p=sl.shapes.add_picture(str(path),Inches(x),Inches(y),Inches(w),Inches(h))
    p.crop_left=rx/iw;p.crop_right=1-(rx+rw)/iw
    p.crop_top=ry/ih;p.crop_bottom=1-(ry+rh)/ih
    return p

def contain(sl,path,x,y,w,h):
    iw,ih=Image.open(path).size;r=iw/ih
    if w/h>r:
        nw=h*r;return picture(sl,path,x+(w-nw)/2,y,nw,h)
    nh=w/r;return picture(sl,path,x,y+(h-nh)/2,w,nh)

def phone(sl, path, x,y,w,h=None,region=None):
    iw,ih=Image.open(path).size
    aspect=(region[3]/region[2]) if region else ih/iw
    h=h or (w-0.13)*aspect+0.13
    box(sl,x+0.07,y+0.08,w,h,"line")
    box(sl,x,y,w,h,"ink")
    picture(sl,path,x+0.065,y+0.065,w-0.13,h-0.13,region=region)
    return h

def icon(sl,kind,x,y,size=0.45,color="blue"):
    # Simple native line icons keep the presentation editable.
    if kind=="pin":
        shape(sl,MSO_SHAPE.OVAL,x+size*.20,y,size*.60,size*.60,"white",color)
        shape(sl,MSO_SHAPE.OVAL,x+size*.40,y+size*.20,size*.20,size*.20,color)
        line(sl,x+size*.30,y+size*.47,x+size*.50,y+size*.94,color,1.7)
        line(sl,x+size*.70,y+size*.47,x+size*.50,y+size*.94,color,1.7)
    elif kind=="camera":
        shape(sl,MSO_SHAPE.ROUNDED_RECTANGLE,x,y+size*.18,size,size*.65,"white",color)
        shape(sl,MSO_SHAPE.RECTANGLE,x+size*.20,y+size*.07,size*.30,size*.16,color)
        shape(sl,MSO_SHAPE.OVAL,x+size*.36,y+size*.34,size*.30,size*.30,"white",color)
    elif kind=="route":
        pts=[(0,.85),(0,.50),(.60,.50),(.60,.10),(.95,.10)]
        for a,b in zip(pts,pts[1:]):line(sl,x+a[0]*size,y+a[1]*size,x+b[0]*size,y+b[1]*size,color,2.2)
        shape(sl,MSO_SHAPE.OVAL,x-size*.06,y+size*.79,size*.13,size*.13,color)
    elif kind=="check":
        line(sl,x+size*.10,y+size*.48,x+size*.40,y+size*.77,color,2.7)
        line(sl,x+size*.40,y+size*.77,x+size*.95,y+size*.12,color,2.7)

def base(n, kicker, title, subtitle="",dark=False):
    sl=prs.slides.add_slide(prs.slide_layouts[6])
    sl.background.fill.solid();sl.background.fill.fore_color.rgb=rgb("blue" if dark else "ivory")
    text(sl,kicker.upper(),0.70,0.43,14,0.23,11.5,"mist" if dark else "coral",True)
    text(sl,title,0.68,0.92,14.60,1.32,35,"white" if dark else "ink",True,spacing=1.12)
    if subtitle:text(sl,subtitle,0.72,2.28,14.45,0.52,17,"mist" if dark else "gray")
    return sl

def footer(sl,n,source,dark=False,extra=None):
    fg="mist" if dark else "gray"
    line(sl,0.72,8.48,15.28,8.48,"lightblue" if dark else "line",0.8)
    if extra:text(sl,extra,0.72,7.99,14.50,0.40,9.7,fg)
    text(sl,source,0.72,8.58,13.85,0.22,9.7,fg)
    text(sl,f"{n:02d} / 10",14.55,8.58,0.74,0.22,10,fg,True,PP_ALIGN.RIGHT)

def header_note(sl,label,x,y,w):
    text(sl,label,x,y,w,0.33,15,"blue",True)

koma=json.loads((ASSETS/"koma-example.json").read_text(encoding="utf-8"))
example=next(c for c in koma["cards"] if c["map"]["sequence"]==koma["introductionSequence"])

def draw_koma(sl,x,y,w,h,card=example,label=True):
    box(sl,x,y,w,h,"pale")
    m=card["map"];scale=min(w/300,h/280)*0.87
    ox=x+(w-300*scale)/2;oy=y+(h-280*scale)/2
    def segs(ps,col,thick):
        for a,b in zip(ps,ps[1:]):
            line(sl,ox+a["x"]*scale,oy+a["y"]*scale,
                 ox+b["x"]*scale,oy+b["y"]*scale,col,thick)
    for b in m["branches"]:segs(b["points"],"lightblue",9)
    for b in m["branches"]:
        if b.get("arrival"):
            segs(b["points"],"ink",5.0)
            p=b["points"][-1]
            shape(sl,MSO_SHAPE.OVAL,ox+p["x"]*scale-.060,oy+p["y"]*scale-.060,.12,.12,"ink")
    for ps in card["arrows"]:
        if len(ps)>1:
            for a,b in zip(ps[:-2],ps[1:-1]):
                line(sl,ox+a["x"]*scale,oy+a["y"]*scale,ox+b["x"]*scale,oy+b["y"]*scale,"blue",4.0)
            a,b=ps[-2],ps[-1]
            arrow(sl,ox+a["x"]*scale,oy+a["y"]*scale,ox+b["x"]*scale,oy+b["y"]*scale,"blue",4.0)
    if label:text(sl,"入ってきた道が下。矢印の方向へ。",x+0.18,y+h-0.48,w-0.36,.27,12,"gray",align=PP_ALIGN.CENTER)

# 01 -- cover
s=prs.slides.add_slide(prs.slide_layouts[6])
s.background.fill.solid();s.background.fill.fore_color.rgb=rgb("ivory")
picture(s,ROOT/"public/mainphotos/hantoupic.jpg",9.15,0,6.85,9,focus=(.72,.50))
shape(s,MSO_SHAPE.RECTANGLE,0,0,9.15,9,"ivory")
icon(s,"route",.76,.64,.47)
text(s,"MIURA WALKING RALLY",1.45,.70,6.8,.35,14,"blue",True)
text(s,"まぐろを食べた、\nその先へ。",.73,1.72,8.18,1.86,48,"ink",True,spacing=1.12)
text(s,"コマ地図でまちを読み解く。\n三浦市ウォーキングラリー",.80,4.02,7.65,1.04,25,"blue",True)
text(s,"参加者の「もう一か所」を、運営者がつくれる。\n徒歩周遊の体験と、コース制作の自動化を\n一つのWebアプリに。",.82,5.50,7.65,1.25,19.5,"ink",spacing=1.23)
pill(s,"三崎・城ヶ島",.82,7.21,1.72)
pill(s,"ブラウザで参加",2.70,7.21,1.99)
pill(s,"ローカル実装済み",4.85,7.21,2.22,"blue","white")
phone(s,ASSETS/"participant-map.png",11.02,1.24,2.95)
text(s,"実装画面",11.84,7.66,1.35,.25,11,"white",True,PP_ALIGN.CENTER)
text(s,"AI実装コンテスト｜読む審査資料｜2026.11.14",.82,8.53,7.75,.25,11,"gray")
text(s,"写真：ユーザー提供／地図：© OpenStreetMap contributors・ODbL",9.40,8.61,6.28,.20,8.5,"white")

# 02 -- problem and target
s=base(2,"01 / Problem & people","食事で終わる訪問を、\nもう一か所の立寄りへ。",
       "ヒアリングの焦点は、訪れた人の滞在時間と、一人当たりの観光消費を増やすこと。")
box(s,.72,3.03,8.40,2.21,"white")
text(s,"地域から示された課題",1.02,3.30,7.8,.35,16,"coral",True)
text(s,"昼食を目的に訪れ、そのまま帰宅・他地域へ。\n一方で、十分に知られていない観光資源もある。",1.02,3.88,7.75,.87,22,"ink",True)
picture(s,ROOT/"public/mainphotos/shitamati.jpg",9.46,3.03,5.82,2.21,focus=(.42,.45))
for x,num,head,body in [
 (.72,"01","参加者","食事や観光で訪れた人。\n前後の時間に、家族や友人と散策する。"),
 (5.66,"02","運営者","自治体・観光協会等の企画担当者。\n訪れてほしい場所をコースにする。"),
 (10.60,"03","地域","飲食店・カフェ・土産店や小さな名所。\n新たに知ってもらう機会を増やす。")]:
    box(s,x,5.65,4.68,1.93,"mist")
    text(s,num,x+.22,5.86,.55,.37,20,"coral",True)
    text(s,head,x+.90,5.86,3.55,.39,21,"blue",True)
    text(s,body,x+.25,6.48,4.18,.83,16.3)
footer(s,2,"根拠：提供資料『三浦市 テーマヒアリングまとめ』②⑤⑦・実施要項／写真：ユーザー提供",
       extra="日帰り需要を入口に、既存の店・景観をつないで追加滞在を生む。制作負担の軽減は本企画の仮説として検証する。")

# 03 -- what koma means + mechanism
s=base(3,"02 / Solution","道を読む楽しさが、\n次の立寄りを生む。",
       "コマ地図＝分岐の形と進む方向を一場面ずつ示す地図。目の前の道と見比べることを遊びにする。")
picture(s,ROOT/"public/mainphotos/shitamati.jpg",.72,3.04,5.00,3.55,focus=(.40,.54))
draw_koma(s,5.98,3.04,4.02,3.55)
box(s,10.26,3.04,5.02,3.55,"blue")
text(s,"いつもの道が、\n小さな冒険になる。",10.60,3.40,4.36,1.02,26,"white",True)
text(s,"分岐を観察し、目印を探す。\n同行者と相談し、写真を残す。\n道中の路地や店にも目が向く。",10.60,4.83,4.30,1.18,18.5,"white",spacing=1.23)
steps=[("現地を観察","道・目印を読む"),("発見と会話","歩くことを楽しむ"),("追加の立寄り","店や景観に出会う"),("滞在・消費機会","地域への効果を狙う")]
for i,(a,b) in enumerate(steps):
    x=.72+i*3.72
    box(s,x,6.93,3.37,.84,"white")
    text(s,a,x+.12,7.02,3.13,.35,16.5,"blue",True,PP_ALIGN.CENTER)
    text(s,b,x+.12,7.40,3.13,.22,12.4,"gray",align=PP_ALIGN.CENTER)
    if i<3:arrow(s,x+3.43,7.35,x+3.66,7.35,"coral",2)
footer(s,3,"根拠：企画概要3節／写真：ユーザー提供／コマ：三崎の近傍交差点・© OpenStreetMap contributors（ODbL）",
       extra="下段は効果仮説。写真とコマは近傍の例で、撮影方位・現地通行まで一致確認した実証写真ではない。")

# 04 -- participant, four explicit screenshots
s=base(4,"03 / Participant journey","選ぶ・歩く・撮る。\nスマホひとつで、まちの発見を共有。",
       "専用アプリのインストールやログインを求めず、コース一覧からそのまま始められる。")
items=[
 ("01","選ぶ","participant-course-card.png","歩く距離・時間と、\nチェックポイント数で選ぶ。"),
 ("02","歩く","participant-before-checkpoint.png","コマと現地を見比べる。\n前後ボタンやスワイプで進む。"),
 ("03","撮る","participant-checkpoint.png","該当コマで地点名と撮影案内。\n写真は自分のスマホに残す。"),
 ("04","振り返る","participant-goal.png","ゴールで写真を見せる案内。\n発見を振り返る体験へ。")]
for i,(num,head,img,body) in enumerate(items):
    x=.72+i*3.70
    text(s,num,x,3.03,.58,.40,22,"coral",True)
    text(s,head,x+.74,3.03,2.63,.40,22,"blue",True)
    phone(s,ASSETS/img,x+.82,3.59,1.72,region=(0,60,786,1644) if num=="01" else None)
    text(s,body,x,7.32,3.37,.57,14.8,spacing=1.16)
footer(s,4,"根拠：要件定義v0.3・参加者実装記録／実装画面：ローカル環境・キャラなしテーマ／© OpenStreetMap contributors・ODbL",
       extra="写真提示は現地運用。アプリは到着・撮影・写真の合否を判定しない。ゴールの受付場所・時間は今後決める。")

# 05 -- operator
s=base(5,"04 / Operator workflow","運営者は、\n訪れてほしい場所と順番を決める。",
       "初期89スポットを地図・一覧から選ぶ。企画と確認に集中できるよう、道順とコマの制作を支援する。")
box(s,.72,3.02,7.34,4.61,"white","line")
picture(s,ASSETS/"operator-landmarks.png",.91,3.20,6.96,4.10,focus=(.5,.10),region=(95,34,1930,1360))
pill(s,"実装画面｜目印はコマ上でもON/OFF",1.08,7.17,4.26,"blue","white",11)
for y,num,head,body in [
 (3.08,"1","地点と訪問順を決める","市場・カフェ・土産・景観・名所など。\nスポットの追加・編集・削除にも対応。"),
 (4.45,"2","生成結果を確認・修正する","最寄り道路の到達点と目印の採否を調整。\n入口・通行・安全性は運営者が確認。"),
 (5.82,"3","保存した版を、参加者へ公開","内容を固定して保存。公開停止・再公開・\n削除まで扱える。保存後は次の作成へ。")]:
    shape(s,MSO_SHAPE.OVAL,8.46,y,.46,.46,"coral")
    text(s,num,8.46,y+.055,.46,.29,16,"white",True,PP_ALIGN.CENTER)
    text(s,head,9.08,y,6.06,.39,21,"blue",True)
    text(s,body,9.08,y+.56,5.90,.72,16.2)
text(s,"人は、企画と現地確認。システムは、道順と図の制作。",8.50,7.40,6.7,.34,16,"coral",True)
footer(s,5,"根拠：要件定義v0.3・初期スポット選定・コース保存仕様／地図・地物：© OpenStreetMap contributors / Mapillary・ODbL",
       extra="写真：mura / Mapillary、2020-07-11、CC BY-SA 4.0（検出領域を切り抜き・縮小）。候補の存在は入口・安全性の確認を意味しない。")

# 06 -- AI
s=base(6,"05 / AI that serves the experience","省略しすぎを防ぐために、\nAIが紛らわしいコマを残す。",
       "道なりの案内を減らす一方で、形の似た分岐を読み間違えやすい場面では案内を追加で保持する。")
ai_cards=[
 (.72,"01","ルールで重要地点を保護","開始・終了、チェックポイント、\n右左折、折り返し、確認待ちなど。\n必要なコマは先に残す。","blue"),
 (5.66,"02","省略候補の形を比較","枝の角度・進む枝・形状を特徴化。\n学習済みRandomForestで、\n次の表示コマとの紛らわしさを照合。","coral"),
 (10.60,"03","紛らわしい候補を追加保持","ルールで省略候補となったものを、\nAIの判断で追加で残す。\n情報不足・推論失敗でも保持する。","blue")]
for x,num,head,body,col in ai_cards:
    box(s,x,3.12,4.68,2.88,"white")
    text(s,num,x+.25,3.34,.85,.65,32,col,True)
    text(s,head,x+.25,4.12,4.18,.40,21,col,True)
    text(s,body,x+.25,4.78,4.18,1.05,15.7,spacing=1.16)
    if num!="03":arrow(s,x+4.72,4.50,x+4.90,4.50,"coral",2)
box(s,.72,6.38,14.56,1.30,"blue")
for x,big,small in [
 (1.04,"350特徴・200本の木","学習済みモデルを同梱しNode.js内で推論"),
 (6.16,"697例で判断一致","元資料からの移植を照合。現地精度とは別"),
 (11.02,"ルールの保持を優先","AIは、必要としたコマを削除しない")]:
    text(s,big,x,6.59,4.70,.39,21,"white",True)
    text(s,small,x,7.17,4.00,.29,12.6,"mist")
footer(s,6,"根拠：『③ ルール＋機械学習の追加保持』・ADR-026／697例は学習にも使用。未見コースの独立精度を表す値ではない",
       extra="経路探索と道路形状は再現可能なアルゴリズム。AIは、コマの取捨選択を補助する。運営者の確認を組み合わせる。")

# 07 -- architecture, current versus future
s=base(7,"06 / Architecture","地域データを事前準備。\nルート生成のたびに、外部取得を繰り返さない。",
       "OSMとMapillaryの素材を整理・同梱し、アプリは保存済みの道路・目印・切り抜きを参照する。")
for x,w,label in [(.72,4.20,"開発PC｜事前準備"),(5.32,5.22,"ローカルアプリ｜生成と保存"),(10.94,4.34,"ブラウザ｜利用")]:
    box(s,x,3.07,w,4.60,"white")
    text(s,label,x+.23,3.27,w-.46,.34,17,"blue",True)
box(s,.98,3.99,3.68,.90,"mist")
text(s,"OpenStreetMap\n道路・スポット・地物",1.19,4.13,3.25,.70,16.5,"blue",True,PP_ALIGN.CENTER)
box(s,.98,5.18,3.68,.90,"mist")
text(s,"Mapillary\n検出情報・写真を128×128へ",1.19,5.32,3.25,.70,15.8,"blue",True,PP_ALIGN.CENTER)
text(s,"地物・座標・出典を持つ索引\n切り抜き439枚を静的に同梱",1.03,6.59,3.60,.66,16,"ink",True)
arrow(s,4.80,5.25,5.22,5.25,"coral",2.5)
box(s,5.59,3.99,4.68,1.07,"blue")
text(s,"Next.js + React / TypeScript\n経路探索・コマ生成・AI補助",5.79,4.17,4.27,.65,17,"white",True,PP_ALIGN.CENTER)
box(s,5.59,5.42,2.20,1.37,"pale")
text(s,"SQLite v8",5.73,5.59,1.92,.31,16,"blue",True,PP_ALIGN.CENTER)
text(s,"スポット・下書き\nコース・公開情報",5.73,6.12,1.92,.56,13.6,"ink",align=PP_ALIGN.CENTER)
box(s,8.06,5.42,2.20,1.37,"pale")
text(s,"ローカルJSON",8.17,5.59,1.98,.31,15,"blue",True,PP_ALIGN.CENTER)
text(s,"編集中の\n目印採否",8.20,6.12,1.92,.56,14,"ink",align=PP_ALIGN.CENTER)
text(s,"学習済みモデルも同梱して推論",5.85,7.10,4.13,.26,13.5,"gray",align=PP_ALIGN.CENTER)
arrow(s,10.61,5.25,10.89,5.25,"coral",2.5)
text(s,"運営者",11.24,4.08,3.70,.38,21,"blue",True)
text(s,"作成・確認・公開\nOSM背景タイルは外部通信",11.24,4.63,3.60,.66,15.5)
line(s,11.24,5.53,14.95,5.53,"line",1)
text(s,"参加者",11.24,5.83,3.70,.38,21,"blue",True)
text(s,"コース選択・コマ閲覧\n開始記録は同じタブに保存",11.24,6.38,3.60,.66,15.5)
footer(s,7,"根拠：地域目印の事前取得・目印統合・SQLite v8仕様／写真439枚は地域準備版。全地点に写真があるという意味ではない",
       extra="AWSは未実装。配信の第一候補はAmplify Hosting。SQLite/JSONの永続保存先・データ移行・運営操作の権限は別途検証する。")

# 08 -- proof of implementation
s=base(8,"07 / Working product & evidence","つくる・公開する・参加する。\n一連の機能が、ローカルで動く。",
       "アイデアの説明に加え、運営者から参加者までつながる実装を用意した。")
metrics=[(.72,"508","単体・回帰テスト","保存失敗・競合・旧版の保持も検証"),
         (5.66,"43","HTTP検査","不正リクエストの拒否も確認"),
         (10.60,"4幅","画面幅の検査","320 / 390 / 768 / 1440px")]
for x,big,head,small in metrics:
    box(s,x,3.04,4.68,2.08,"white")
    text(s,big,x+.25,3.22,2.80,.91,48,"blue",True)
    text(s,head,x+.25,4.24,4.13,.31,17,"ink",True)
    text(s,small,x+.25,4.73,4.13,.22,12.6,"gray")
picture(s,ASSETS/"operator-published.png",.72,5.52,7.00,1.64)
text(s,"実装画面｜公開状態と参加者確認への入口",.74,7.29,7.00,.25,13,"gray")
box(s,8.10,5.52,7.18,2.10,"mist")
text(s,"ブラウザで実操作を確認",8.40,5.75,6.60,.38,21,"blue",True)
text(s,"地点選択 → 生成 → 保存 → 公開 → 参加者開始。\n削除と保存後の下書き初期化も操作確認。\n停止・再公開は既存のブラウザ検証で確認。\n型チェックと本番ビルドも成功。",8.40,6.22,6.56,1.29,16.0,spacing=1.20)
footer(s,8,"根拠：2026-11-14時点の保存/削除・公開停止/再公開の検証記録。数値は既存アプリの検証結果で、利用者数や経済効果ではない",
       extra="次の検証：実機・現地の読みやすさと安全性、初見ユーザーの理解度、滞在・消費への効果、AWS動作。")

# 09 -- effects and evaluation
s=base(9,"08 / Value & validation","増やしたいのは、\n立寄りと滞在、地域の消費機会。",
       "コマ地図の探索体験が、追加の立寄りや滞在につながるかを現地で検証する。")
for x,head,body,measure in [
 (.72,"参加者","道や景色を観察し、\n同行者と発見を共有する。","楽しさ・発見した場所・迷った箇所"),
 (5.66,"店舗・地域","まだ知らない店や名所へ。\n飲食・買い物の機会をつくる。","立寄り先・滞在時間・任意の消費額"),
 (10.60,"運営者","コースをつくり、更新し、\n継続して周遊体験を届ける。","制作時間・修正回数・操作完了率")]:
    box(s,x,3.10,4.68,3.10,"white")
    icon(s,"pin" if head!="運営者" else "route",x+.28,3.35,.48)
    text(s,head,x+.95,3.38,3.45,.47,23,"blue",True)
    text(s,body,x+.28,4.17,4.12,.88,20,"ink",True)
    text(s,"確かめること",x+.28,5.36,4.12,.25,12.6,"coral",True)
    text(s,measure,x+.28,5.77,4.12,.25,13.4,"gray")
box(s,.72,6.57,14.56,1.13,"blue")
text(s,"効果測定の設計",1.02,6.80,2.52,.34,18,"white",True)
text(s,"現地試用・アンケート・店舗への聞き取りと、制作時間の比較で確認する。\n開始記録や概算歩行時間だけを、実際の滞在・消費の実績として扱わない。",3.66,6.77,11.12,.69,16.5,"white",spacing=1.18)
footer(s,9,"根拠：企画概要6節・提供ヒアリングの示唆／本ページは期待効果と検証計画。滞在・消費の増加は未測定",
       extra="上位目的は「三浦ディープステイ」。宿泊増・混雑緩和は、コースの配置や地域運用も含めた今後の評価対象。")

# 10 -- next validation and strong conclusion
s=base(10,"09 / Next step","地域の資源を、\nつくり続けられる周遊体験に。",
       "参加者の楽しさと、運営者のつくりやすさを両立する。",dark=True)
for x,num,head,body in [
 (.72,"01","現地で使えるかを確認","入口・通行・目印・コマの読解を点検。\nゴールの受付担当と時間を決める。"),
 (5.66,"02","行動と価値を確かめる","初見の人に使ってもらい、迷いを観察。\n立寄り・滞在・消費と制作負担を評価。"),
 (10.60,"03","継続提供へ移す","AWS配信と永続保存・移行を検証。\n権限・費用・更新方法を整理する。")]:
    box(s,x,3.15,4.68,2.78,"white")
    text(s,num,x+.25,3.37,.80,.63,30,"coral",True)
    text(s,head,x+.25,4.10,4.18,.42,22,"blue",True)
    text(s,body,x+.25,4.85,4.16,.70,16.3,"ink")
text(s,"食べて終わる訪問に、\n歩いて発見する時間を。",.81,6.47,8.95,1.20,31,"white",True,spacing=1.12)
text(s,"次の一歩は、三崎・城ヶ島での\n小規模な現地試用。",10.65,6.66,4.45,.79,20,"mist",True)
footer(s,10,"企画概要と現行実装に基づく提案｜三浦市ウォーキングラリー｜2026.11.14",True,
       extra="現在はローカル実装。現地検証・受付運用・効果測定・AWS移行を、次段階として順に確かめる。")

assert len(prs.slides)==10
# Source and license links remain inside the visible attribution line.
for sh in prs.slides[4].shapes:
    if sh.has_text_frame and sh.text.startswith("写真：mura"):
        original=sh.text
        p=sh.text_frame.paragraphs[0];p.clear()
        pieces=[("写真：mura / ",None),("Mapillary","https://www.mapillary.com/app/?pKey=1406211946378470"),
                ("、2020-07-11、",None),("CC BY-SA 4.0","https://creativecommons.org/licenses/by-sa/4.0/"),
                ("（検出領域を切り抜き・縮小）。候補の存在は入口・安全性の確認を意味しない。",None)]
        for value,url in pieces:
            r=p.add_run();r.text=value;r.font.name=FONT;r.font.size=Pt(9.7);r.font.color.rgb=rgb("gray")
            if url:r.hyperlink.address=url
# A source note is included in each slide; no critical content is deferred to notes.
for i,sl in enumerate(prs.slides,1):
    texts=[sh.text for sh in sl.shapes if sh.has_text_frame and sh.text]
    sl.notes_slide.notes_text_frame.text = (
        f"第{i}枚。本文と注記はスライド内で完結します。\n"
        "資料基準: docs/project-overview.md / 2026-11-14。\n"+
        "\n".join(texts))
    for sh in sl.shapes:
        if sh.left < 0 or sh.top < 0 or sh.left+sh.width > prs.slide_width+Inches(.005) or sh.top+sh.height > prs.slide_height+Inches(.005):
            audit.append(dict(slide=i,name=sh.name,issue="outside slide"))
if audit: raise ValueError(audit)
prs.save(OUT)

# Text copy is convenient for review and future content updates.
copy=["# ハッカソン審査資料・スライド本文","", "10枚／口頭補足なしで読む構成。", ""]
for i,sl in enumerate(prs.slides,1):
    copy.extend([f"## {i:02d}", ""])
    for sh in sl.shapes:
        if sh.has_text_frame and sh.text:copy.extend([sh.text,""])
(HERE/"slide-text.md").write_text("\n".join(copy),encoding="utf-8")
assets=[]
for p in sorted(used_images):
    assets.append(dict(path=p.relative_to(ROOT).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),size=p.stat().st_size))
(HERE/"assets-used.json").write_text(json.dumps(dict(slides=10,images=assets),ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(dict(pptx=str(OUT),slides=len(prs.slides),bytes=OUT.stat().st_size,nativeTextAndShapes=True,geometryIssues=len(audit)),ensure_ascii=False))
