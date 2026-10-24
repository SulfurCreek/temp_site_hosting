#!/usr/bin/env python3
"""由鴻築麗苑（柏毅室內裝修 2026/10/19）施工圖量測結果產生 defaultLayout.json / catalog 增補 / materials.json / mep.json。
座標單位公尺，原點 = 建物外包中心（見 CLAUDE.md〈鴻築麗苑專案〉）。執行：python3 scripts/gen-hongzhu-data.py"""
import json, copy

def M(color, r, m=0, **k): return {"color": color, "roughness": r, "metalness": m, **k}

# ---------- 材質庫 ----------
LIB = [
 {"id":"ED-KS81555","name":"超耐磨木地板 ED-KS81555（溫潤淺橡）","brand":"超耐磨","code":"ED-KS81555","note":"全室木地板；圖面另有 ED-KS83555 為廚房檯面石材標示。實景照（往陽台看）地板呈偏灰淺木紋，比內建淺橡略冷，可在材質面板降低色彩飽和度微調","spec":M("#ffffff",0.55,0,map="builtin:oak-light",repeat=1)},
 {"id":"CW025501","name":"玄關落塵區地磚 CW025501-25504（灰階）","brand":"","code":"CW025501-25504","note":"施工圖指定；實景參考改選右版花磚（見 ENCAUSTIC-REF）","spec":M("#ffffff",0.45,0,map="builtin:tile-gray",repeat=1)},
 {"id":"ENCAUSTIC-REF","name":"玄關花磚（實景參考右版：米白八角 + 橘紅小方塊）","note":"2026/10 使用者選定右版；目視估色","spec":M("#ffffff",0.42,0,map="builtin:encaustic",repeat=1)},
 {"id":"DULUX-LILY","name":"得利乳膠漆「百合白」","brand":"Dulux 得利","code":"百合白","note":"蛋殼光 roughness 0.65","spec":M("#F7F5F0",0.65,0)},
 {"id":"EGGER-W1000-ST19","name":"EGGER W1000 ST19 至尊消光白","brand":"EGGER","code":"W1000 ST19","note":"系統櫃外觀板材；消光","spec":M("#f1f0ec",0.8,0)},
 {"id":"EGGER-U708-ST9","name":"EGGER U708 ST9 淺灰（花崗岩灰）","brand":"EGGER","code":"U708 ST9","note":"玄關鞋櫃內部層板","spec":M("#c3c3c1",0.85,0)},
 {"id":"EGGER-U727-ST9","name":"EGGER U727 ST9 石頭灰","brand":"EGGER","code":"U727 ST9","note":"儲藏室/延伸櫃內部層板","spec":M("#a8a6a1",0.85,0)},
]
S = {x["id"]:x["spec"] for x in LIB}
W1000, U708, U727 = S["EGGER-W1000-ST19"], S["EGGER-U708-ST9"], S["EGGER-U727-ST9"]
PAINT = S["DULUX-LILY"]
HANDLE = M("#8a8a8a",0.25,0.9)
CONC = M("#b9b8b3",0.9,0)

# ---------- 牆 ----------
def wall(i,name,s,e,t,ext,mat=PAINT,h=2.6,ops=None):
    return {"id":i,"name":name,"start":s,"end":e,"height":h,"thickness":t,"exterior":ext,"material":copy.deepcopy(mat),"openings":ops or []}
def op(i,typ,at,w,h,sill): return {"id":i,"type":typ,"at":round(at,3),"width":w,"height":h,"sill":sill}
WIN=dict(h=1.574,sill=0.375)   # 台37.5 / H194.9
xw=-4.675; zn=-2.62
walls=[
 wall("wall-w","西牆（玄關大門）",[xw,zn],[xw,2.96],0.15,True,ops=[op("door-main","door",2.015-zn,0.9,2.1,0)]),
 wall("wall-n1","北牆（次臥窗）",[xw,zn],[0.44,zn],0.17,True,ops=[
    op("win-n1","window",-3.225-xw,1.33,WIN["h"],WIN["sill"]),
    op("win-n2","window",-2.066-xw,0.40,WIN["h"],WIN["sill"]),
    op("win-n3","window",-0.20-xw,0.79,WIN["h"],WIN["sill"])]),
 wall("wall-n2","北牆凹口側牆",[0.44,zn],[0.44,-3.255],0.12,True),
 wall("wall-n3","北牆（主臥）",[0.44,-3.255],[4.40,-3.255],0.15,True),
 wall("wall-e1","東牆（主臥窗）",[4.40,-3.255],[4.40,-0.074],0.30,True,ops=[op("win-e1","window",-1.33+3.255,1.78,WIN["h"],WIN["sill"])]),
 wall("wall-e2","廚房東牆（DW1 落地門）",[3.14,-0.074],[3.14,2.96],0.20,True,ops=[op("door-dw1","door",1.41+0.074,1.58,2.07,0.12)]),
 wall("wall-s1","南牆（玄關段 100）",[xw,2.96],[-2.69,2.96],0.15,True),
 wall("wall-s2","半牆（客廳段 275，H120 厚11.5）",[-2.69,2.9425],[0.07,2.9425],0.115,False,h=1.2),
 wall("wall-s3","南牆（廚房段）",[0.07,2.96],[3.14,2.96],0.15,True),
 wall("part-tv","電視牆（不預留貓道）",[-1.26,-1.63],[-1.26,-0.03],0.18,False,mat=M("#e4e0d8",0.85)),
 wall("part-shaft","管道間（保留）",[-1.135,-2.535],[-1.135,-1.63],0.43,False,mat=M("#cfcdc7",0.9)),
 wall("part-south","衛浴/主臥南隔間",[-1.17,-0.074],[4.40,-0.074],0.10,False,ops=[
    op("door-bath","door",0.62,0.75,2.1,0),
    op("door-master","door",1.06+1.17,0.75,2.1,0)]),
 wall("part-bath-master","衛浴/主臥隔間",[0.555,-2.617],[0.555,-0.074],0.10,False),
 wall("part-wet","乾濕分離玻璃（估計位置）",[-0.20,-2.535],[-0.20,-0.124],0.02,False,mat=M("#bfe3f5",0.05,0,opacity=0.25),h=2.0),
 wall("rail-e","陽台欄杆（東）",[4.60,-0.074],[4.60,3.0],0.06,False,h=1.1),
 wall("rail-s","陽台欄杆（南）",[3.24,3.0],[4.60,3.0],0.06,False,h=1.1),
]

# ---------- 家具實例 ----------
def f(i,cat,name,pos,rot,size,**k):
    d={"id":i,"catalogId":cat,"name":name,"position":[round(v,3) for v in pos],"rotationY":rot,"size":size}; d.update(k); return d
furn=[
 f("col-tl","structural-column","結構柱 左上",[-4.34,0,-2.935],0,[0.82,2.6,0.80],locked=True),
 f("col-tr","structural-column","結構柱 右上",[4.34,0,-2.985],0,[0.80,2.6,0.70],locked=True),
 f("col-bl","structural-column","結構柱 左下",[-4.34,0,2.94],0,[0.82,2.6,0.80],locked=True),
 f("col-br","structural-column","結構柱 右下",[4.39,0,2.94],0,[0.70,2.6,0.80],locked=True),
 f("shoe","shoe-cabinet","玄關鞋櫃",[-3.19,0,2.7125],180,[1.0,2.37,0.35]),
 f("storage","ewardrobe-room","儲藏室（電子衣櫥）",[-4.01,0,0.96],0,[1.18,2.37,0.75]),
 f("cab72","cabinet-72","延伸櫃 72×70",[-3.04,0,0.935],0,[0.72,2.37,0.70]),
 f("wardrobe","wardrobe-master","主臥大衣櫃",[1.01,0,-2.185],90,[2.0,2.4,0.70]),
 f("bed","bed-double","主臥雙人床",[3.162,0,-2.185],0,[1.55,0.9,2.0]),
 f("tv","tv-wall","主臥電視",[3.60,0.85,-0.154],180,[1.2,0.7,0.06]),
 f("ac-in","ac-indoor","冷氣室內機（主臥）",[4.13,2.0,-1.14],0,[0.24,0.30,0.80]),
 f("fridge","fridge","冰箱",[2.633,0,0.37],0,[0.62,1.80,0.62]),
 f("kitchen","kitchen-run","一字型廚具 230",[1.89,0,2.585],180,[2.30,0.85,0.60]),
 f("sink","sink","水槽",[1.305,0.85,2.55],180,[0.72,0.12,0.40]),
 f("hob","hob","雙口爐",[2.58,0.85,2.52],180,[0.84,0.05,0.45]),
 f("toilet","toilet","免治馬桶",[-0.73,0,-1.20],90,[0.44,0.75,0.69]),
 f("vanity","vanity","洗手台櫃",[-0.83,0,-0.425],90,[0.55,0.85,0.50]),
 f("basin","basin","洗手盆",[-0.83,0.85,-0.425],90,[0.45,0.12,0.40]),
 f("ac-out","ac-outdoor","冷氣室外機",[2.9,0,3.2],0,[0.80,0.70,0.30]),
 f("washer","washer","洗衣機（工作陽台）",[4.0,0,0.5],0,[0.60,0.85,0.60]),
]

# ---------- 地板與分區 ----------
floor={"center":[-0.175,-0.1475],"size":[8.85,6.065],"material":copy.deepcopy(S["ED-KS81555"])}
zones=[
 {"id":"z-foyer","name":"玄關落塵區（花磚）","center":[-3.645,2.11],"size":[1.91,1.55],"material":copy.deepcopy(S["ENCAUSTIC-REF"])},
 {"id":"z-bath","name":"衛浴地磚","center":[-0.3325,-1.3295],"size":[1.675,2.411],"material":M("#ffffff",0.3,0,map="builtin:tile",repeat=1)},
 {"id":"z-balcony","name":"工作陽台","center":[3.92,1.463],"size":[1.36,3.074],"material":M("#ffffff",0.6,0,map="builtin:tile-gray",repeat=1)},
 {"id":"z-outside","name":"北側凹口（室外）","center":[-2.08,-2.9],"size":[4.68,0.56],"material":M("#e3e8ee",1,0)},
]
layers=[
 {"id":"plan","name":"平面配置圖","url":"/inputs/floorplans/hongzhu-1-plan.png"},
 {"id":"outlets","name":"插座圖","url":"/inputs/floorplans/hongzhu-2-outlets.png"},
 {"id":"lights","name":"燈具圖","url":"/inputs/floorplans/hongzhu-3-lights.png"},
 {"id":"switches","name":"開關圖","url":"/inputs/floorplans/hongzhu-4-switches.png"},
]
layout={"version":1,"rev":2,"name":"鴻築麗苑（柏毅 2026/10/19 施工圖）",
 "floor":floor,"floorZones":zones,"walls":walls,"furniture":furn,
 "blueprint":{"url":layers[0]["url"],"layers":layers,"layerId":"plan","name":"鴻築麗苑 施工圖","widthMeters":10.264,"opacity":0.6,"offset":[0,0],"rotation":0,"visible":True,"placement":"under"},
 "references":[],"customCatalog":[]}
json.dump(layout,open('src/data/defaultLayout.json','w'),ensure_ascii=False,indent=2)
json.dump(LIB,open('src/data/materials.json','w'),ensure_ascii=False,indent=2)

# ---------- 目錄增補 ----------
cat=json.load(open('src/data/catalog.json'))
ids={c["id"] for c in cat}
def item(i,name,c,size,kind,mats,count=None,notes=None):
    p={"kind":kind,"materials":mats}
    if count: p["count"]=count
    d={"id":i,"name":name,"category":c,"mode":"parametric","size":size,"parametric":p}
    if notes: d["notes"]=notes
    return d
new=[
 item("structural-column","結構柱","custom",[0.8,2.6,0.8],"box",{"main":CONC}),
 item("shoe-cabinet","玄關鞋櫃（EGGER W1000 ST19）","storage",[1.0,2.37,0.35],"cabinet",{"main":W1000,"secondary":U708,"accent":HANDLE},2,
   ["外觀板材：EGGER W1000 ST19 至尊消光白","內部層板：U708 ST9 淺灰（花崗岩灰）","8 層斜放/平放鞋架；透氣孔 + 穿線孔；側面插座開孔","接續下方牆面 100cm 段"]),
 item("ewardrobe-room","儲藏室（電子衣櫥區 118×75）","storage",[1.18,2.37,0.75],"cabinet",{"main":W1000,"secondary":U727,"accent":HANDLE},2,
   ["外觀：W1000 ST19 至尊消光白；內部層板：U727 ST9 石頭灰","電子衣櫥預留空間：寬 60 × 高 196.5 cm","左右各預留 5cm、上方預留 20cm 散熱","穿線孔、側插座；燈條 3000K H237"]),
 item("cabinet-72","儲藏延伸櫃 72×70","storage",[0.72,2.37,0.70],"cabinet",{"main":W1000,"secondary":U727,"accent":HANDLE},1,
   ["外觀：W1000 ST19 至尊消光白；內部層板：U727 ST9 石頭灰","接續儲藏室 118×75 櫃體"]),
 item("wardrobe-master","主臥大衣櫃 200×70","storage",[2.0,2.4,0.70],"cabinet",{"main":W1000,"secondary":M("#f4f3ef",0.7),"accent":HANDLE},2,
   ["白框 + W1000 ST19 至尊消光白 推拉門","內部：上下雙層吊衣桿 + 層板","開門感應燈條 4000K"]),
 item("tv-wall","壁掛電視","decor",[1.2,0.7,0.06],"box",{"main":M("#15171a",0.25,0.4)}),
 item("ac-indoor","冷氣室內機","decor",[0.24,0.30,0.80],"box",{"main":M("#f2f2f0",0.5,0.1)}),
 item("ac-outdoor","冷氣室外機","decor",[0.80,0.70,0.30],"box",{"main":M("#d9dcdf",0.5,0.4)}),
 item("fridge","冰箱（白色，實景照）","decor",[0.62,1.80,0.62],"box",{"main":M("#f1f1ef",0.35,0.1)},None,["實景：白色雙門冰箱，位於落地門左側"]),
 item("washer","洗衣機","decor",[0.60,0.85,0.60],"box",{"main":M("#eeeeec",0.4,0.2)}),
 item("kitchen-run","一字型廚具 230","storage",[2.30,0.85,0.60],"cabinet",{"main":M("#e6e2d9",0.55),"secondary":M("#c9c5bb",0.6),"accent":HANDLE},5,
   ["左：水槽（下方預留掃地機上下水 + 洗碗機專用插座）","右：雙口爐；上方靠中島側預留冰箱位","檯面延伸石材；側邊貼磚 GA326201"]),
 item("sink","廚房水槽","decor",[0.72,0.12,0.40],"sink",{"main":M("#c8cacc",0.3,0.9),"secondary":M("#2a2c2e",0.4,0.5),"accent":M("#9a9ea3",0.2,1)}),
 item("hob","雙口爐","decor",[0.84,0.05,0.45],"hob",{"main":M("#16181a",0.2,0.3),"secondary":M("#555a60",0.4,0.8)}),
 item("toilet","免治馬桶","decor",[0.44,0.75,0.69],"toilet",{"main":M("#f6f6f4",0.2,0),"secondary":M("#ecece9",0.3,0)},None,["免治馬桶專用插座（見 MEP 圖層）"]),
 item("vanity","洗手台櫃","storage",[0.55,0.85,0.50],"cabinet",{"main":M("#f1f0ec",0.5),"secondary":M("#dcdad3",0.6),"accent":HANDLE},1),
 item("basin","洗手盆","decor",[0.45,0.12,0.40],"sink",{"main":M("#f6f6f4",0.2,0),"secondary":M("#e9e9e6",0.2,0),"accent":M("#9a9ea3",0.2,1)}),
]
for n in new:
    if n["id"] in ids: cat=[c for c in cat if c["id"]!=n["id"]]
    cat.append(n)
json.dump(cat,open('src/data/catalog.json','w'),ensure_ascii=False,indent=2)

# ---------- MEP ----------
mep=[]
def m(i,kind,label,x,z,h,face=None,src="",assumed=False,**k):
    d={"id":i,"kind":kind,"label":label,"at":[round(x,3),round(z,3)],"h":h}
    if face: d["face"]=face
    d["src"]=src
    if assumed: d["assumed"]=True
    d.update(k); mep.append(d)
P2="插座圖"; P3="燈具圖"; P4="開關圖"
# 客廳主牆（南，z=2.885，朝北 N）
for i,(x,hs,ded) in enumerate([(-0.22,[0.30,1.65],[1.65]),(0.003,[0.30,1.08],[]),(0.33,[1.08,1.50],[1.50])]):
    for h in hs:
        m(f"liv-{i}-{int(h*100)}","dedicated" if h in ded else "outlet",
          f"客廳主牆插座 H:{int(h*100)}"+("（110V 專用迴路）" if h in ded else ""),x,2.885,h,"N",P2+" W:317/302/原有+10")
m("liv-weak","weak","弱電/網路（客廳主牆）",0.536,2.885,0.30,"N",P2,True)
m("shoe-165","outlet","鞋櫃側 H:165",-2.59,2.885,1.65,"N",P2)
m("cab72-30","outlet","延伸櫃側 H:30",-2.68,0.68,0.30,"E",P2)
m("stor-30a","outlet","儲藏室穿線孔 H:30",-3.687,0.585,0.30,"N",P2)
m("stor-30b","outlet","儲藏室穿線孔 H:30",-3.52,0.585,0.30,"N",P2)
m("stor-70a","outlet","天花板音響 H:70",-4.349,0.585,0.70,"N",P2)
m("stor-70b","outlet","天花板音響 H:70",-4.053,0.585,0.70,"N",P2)
m("cur-nw1","outlet","窗簾盒插座 H:70",-4.17,-2.535,0.70,"S",P2)
m("cur-nw2","outlet","窗簾盒插座",-4.50,-2.35,0.70,"E",P2,True)
m("tv-w80","outlet","次臥電視牆 W:30 H:80",-1.35,-0.89,0.80,"W",P2)
m("tv-w30","outlet","次臥電視牆 W:30 H:30",-1.35,-0.69,0.30,"W",P2)
m("weak-n","weak","TV/網路（次臥北牆）",-2.18,-2.535,0.30,"S",P2,True)
m("weak-w","weak","TV/網路（次臥西牆）",-4.50,-0.43,0.30,"E",P2,True)
for i,x in enumerate([-0.404,-0.186,0.022]): m(f"weak-ps{i}","weak","弱電（衛浴南牆外側）",x,-0.024,0.30,"S",P2,True)
# 主臥
m("bed-55a","dedicated","床頭插座 H:55（110V 專用）",1.885,-3.18,0.55,"S",P2)
m("bed-55b","dedicated","床頭插座 H:55（110V 專用）",2.07,-3.18,0.55,"S",P2)
m("bed-weak1","weak","TV/網路（床頭左）",1.15,-3.18,0.30,"S",P2,True)
m("bed-weak2","weak","TV/網路（床頭右）",3.54,-3.18,0.30,"S",P2,True)
m("master-cur","outlet","窗簾盒插座",4.25,-2.44,2.20,"W",P2,True)
m("master-tv30","outlet","電視牆插座 H:30",3.71,-0.124,0.30,"N",P2)
m("master-tvweak","weak","電視 TV/網路",2.42,-0.124,0.30,"N",P2,True)
m("master-100","dedicated","110V 專用迴路 H:100（原有插座往上新增）",1.69,-0.024,1.00,"S",P2)
# 廚房
m("kit-110a","outlet","檯面插座 H:110",0.826,2.885,1.10,"N",P2)
m("kit-110b","outlet","檯面插座 W:108 H:110",1.91,2.885,1.10,"N",P2)
m("kit-water","water","掃地機上下水（側邊櫃內）",1.07,2.885,0.30,"N",P2,True)
m("kit-sweeper","dedicated","掃地機專用插座（側邊櫃內）",1.0,2.885,0.30,"N",P2,True)
m("kit-dw","dedicated","廚下 220V 洗碗機",1.086,2.885,0.30,"N",P2)
m("kit-heater","dedicated","廚下 220V 瞬熱",1.264,2.885,0.30,"N",P2)
m("kit-weak","weak","TV/網路",0.536,2.885,0.30,"N",P2,True)
m("dryer-120","dedicated","110V 專用迴路（烘衣機）H:120",3.24,2.55,1.20,"E",P2)
# 開關（p4；高度圖面未標者暫設 1.20）
for i,(x,z,face,h,asm,lab) in enumerate([
  (-4.45,-2.21,"E",1.20,True,"次臥 對切開關（新增）"),
  (-4.45,1.52,"E",1.20,True,"玄關 ONE 開關（新增）"),
  (-1.335,-0.106,"S",1.20,True,"客餐廳/衛浴 開關"),
  (0.55,0.18,"S",1.20,True,"客廳 開關"),
  (1.00,-1.015,"E",1.20,True,"衛浴/主臥 開關（移位 烤漆平面白）"),
  (1.78,-0.124,"N",1.00,False,"主臥入口開關 H:100"),
  (3.995,-3.18,"S",1.20,True,"床頭開關")]):
    m(f"sw-{i}","switch",lab,x,z,h,face,P4,asm)
# 燈具
m("trk-bed2","track","次臥軌道燈（3 燈頭）",-4.125,-0.9,2.5,src=P3,length=2.31,dir="z",heads=3,assumed=False)
m("trk-liv","track","客廳軌道燈（4 燈頭）",-0.655,0.458,2.5,src=P3,length=2.65,dir="x",heads=4)
m("ce-bed2","ceiling","次臥 40CM 吸頂燈",-2.87,-0.908,2.6,src=P3,diameter=0.40)
m("ce-master","ceiling","主臥 40CM 吸頂燈",2.204,-1.363,2.6,src=P3,diameter=0.40)
m("ce-bath","ceiling","衛浴吸頂燈",-0.09,-0.93,2.6,src=P3,diameter=0.2,assumed=True)
m("fan-liv","fan","客廳吊扇燈（40CM）",-0.652,1.70,2.6,src=P3,diameter=0.40)
m("dl-entry","downlight","玄關嵌燈",-3.52,1.91,2.6,src=P3)
m("dl-b2a","downlight","次臥嵌燈",-1.61,-2.19,2.6,src=P3,assumed=True)
m("dl-b2b","downlight","次臥嵌燈",-1.61,-0.58,2.6,src=P3,assumed=True)
m("dl-k1","downlight","廚房嵌燈",1.24,1.127,2.6,src=P3)
m("dl-k2","downlight","廚房嵌燈",2.387,1.127,2.6,src=P3)
m("st-entry","strip","玄關燈條 3000K H237",-3.04,1.30,2.37,src=P3,length=1.9,dir="x")
json.dump(mep,open('src/data/mep.json','w'),ensure_ascii=False,indent=2)
print(len(walls),'walls',len(furn),'furniture',len(mep),'mep')
