"""Screenprinted night-broadcast illustration. The articulated operator lives in art/operator.svg."""
from pathlib import Path
import math
from svg_raster import draw
ROOT=Path(__file__).resolve().parents[1]
OP=(ROOT/'art/operator.svg').read_text()
PALETTES=[
('#e4d7b7','#de654b','#899e9a','#354858'),('#e9c9a2','#d45643','#849a9a','#334859'),
('#c2d6cc','#eb8150','#738f9c','#30445a'),('#e7bdad','#947f9b','#b17d78','#354252'),
('#e9a77e','#fae5a5','#b27168','#3b4658')]
def wrap(s):return '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="575" viewBox="0 0 720 575">'+s+'</svg>'
def backdrop(stage):
    paper,sun,mid,ink=PALETTES[stage]
    s=f'''<defs>
    <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1.12" fill="{ink}" opacity=".43"/></pattern>
    <pattern id="sc" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 2l4-4m-2 10 8-8m-2 10 4-4" stroke="{ink}" opacity=".37" stroke-width="1.2"/></pattern>
    <clipPath id="disc"><circle cx="315" cy="221" r="188"/></clipPath></defs>
    <path fill="{paper}" d="M0 0h720v575H0z"/>
    <path fill="{mid}" opacity=".38" d="M0 418L268 0h40L16 540H0zM637 0h83v206L467 575H328z"/>
    <path fill="url(#dots)" d="M535 0H720v111L412 575H210zM0 0h128L0 193z"/>
    <circle cx="315" cy="221" r="188" fill="{sun}"/>
    <g clip-path="url(#disc)" fill="{paper}" opacity=".74">'''
    for j in range(13):s+=f'<path d="M72 {301+j*9}h485v{.7+j*.30}H72z"/>'
    s+='</g>'
    for j in range(5):
        s+=f'<circle cx="315" cy="221" r="{197+j*10}" fill="none" stroke="{ink}" stroke-width="{1.3 if j in [0,4] else .55}" opacity=".46" stroke-dasharray="{155+j*25} 24 48 12"/>'
    s+=f'''<g stroke="{ink}" stroke-width="1.7" fill="none" opacity=".67">
    <path d="M-10 268Q95 286 157 232T346 211M-10 274Q92 290 157 237T346 217M-10 280Q95 293 157 243T346 221"/>
    <path d="M596 79q64 26 140 15m-140-10q70 25 143 16"/></g>'''
    # Rooftops, insulators, the relay mast and feeder lines.
    s+=f'''<path fill="{mid}" d="M0 385h39v-21h27v6h52v-17h43v9h25v-23h55v-19h8v53h82v-20h77v13h44v-44h33v-19h6v18h24v35h65v-16h39v-29h57v-8h22v13h22v115H0z"/>
    <g fill="{ink}" opacity=".85"><path d="M0 420l24-2v-28h66v18h46v-31h55v23h33v-7h38v54h69v-20h98v-27h57v14h68v-22h53v-24h45l14 15h54v138H0z"/>
    <path d="M103 406l24-229h4l23 229h-7l-5-52h-27l-6 52zm13-59h25l-11-112z" fill-rule="evenodd"/></g>
    <g stroke="{ink}" fill="none" stroke-width="2.2"><path d="M129 179v-42m-9 55h18m-22 37h25m-27 27h30m-29 20 27 19-29 20 32 20-32 17m-19-75 32-82 28 90"/>
    <path d="M80 303l49-113 64 143M129 170Q69 219 0 218m129-45q-69 52-129 48" stroke-width=".9"/></g>
    <path fill="url(#sc)" d="M0 378l35-17 46 6 75-48-8 48-51 42L0 429zM541 322l91-57 88 24v36l-90-31z"/>
    <g fill="{paper}" opacity=".8">'''
    for x,y in [(21,407),(58,399),(146,391),(197,411),(630,385),(667,410),(696,407)]:
        s+=f'<path d="M{x} {y}h8v3h-8zm11 0h4v3h-4z"/>'
    s+='</g>'
    return wrap(s)
def desk(stage):
    paper,sun,mid,ink=PALETTES[stage]
    s='''<g stroke="#253442" stroke-width="3" stroke-linejoin="round">
    <path d="M-4 534L724 469v112H-4Z" fill="#6f8389"/>
    <path d="M-4 541l728-62m-728 91 728-65" fill="none" stroke="#9fafad" stroke-width="1.2"/>
    <path d="M588 507l98-7-4 21-99 6z" fill="#354855"/><path d="M603 511l29-2m-31 6 20-1" stroke="#d0c08e" stroke-width="1.5"/>
    <path d="M-30 511L169 441 409 470 241 578H-30Z" fill="#a7b6b4"/>
    <path d="M-14 532l198-73 172 19-157 80Z" fill="#536775"/>
    <path d="M-20 545l243 21 177-91 20 5-172 107H-20Z" fill="#e27b52"/>
    <path d="M238 577l172-102 1 16-141 86Z" fill="#405464"/>
    <path d="M-16 526l59-23 69 8-58 24Z" fill="#243747"/>
    <path d="M122 481l43-17 48 5-36 17Z" fill="#283a49"/>
    <path d="M55 519l-9 3 18 2 9-4Z" fill="#94ddbf" stroke="none"/>
    <path d="M284 492l29-13 24 2-28 15Z" fill="#c7d4c3"/>
    </g>'''
    for row in range(3):
        for j in range(5):
            x=119+j*17-row*12;y=496+j*1.65+row*5.6
            s+=f'<path d="M{x} {y}l9-3.9 12 1.2-8.8 4.2z" fill="{["#e8c586","#819a9b","#de8a64"][(row+j)%3]}" stroke="#2f4250" stroke-width="1.1"/>'
    for j in range(4):
        x=226+j*15;y=501+j*1.4
        s+=f'<path d="M{x} {y}l-44 20" fill="none" stroke="#1b303e" stroke-width="2.6"/><path d="M{x-14-j*5} {y+3+j*2}l10 1-5 4-10-1z" fill="#e3d5ac" stroke="#223545" stroke-width="1"/>'
    s+='<path d="M358 502q33-4 40 15t43 14q80-4 90 44m-168-66q28-7 32 10t46 18" fill="none" stroke="#263844" stroke-width="3"/>'
    return wrap(s)
def actor(stage,tick,scale):
    p=tick/32*2*math.pi
    bop=(1-math.cos(2*p))/2; swing=math.sin(p)
    lean=[-2,-.7,.6,1.1,-1][stage]+1.9*swing
    z=[.99,1.02,1.035,1.105,1.055][stage]
    cx=[7,15,-7,-28,2][stage];cy=[8,4,-1,-7,0][stage]
    cam=f'translate({cx} {cy}) translate(352 304) scale({z}) translate(-352 -304)'
    body=f'translate({3*swing:.2f} {5*bop:.2f}) rotate({lean:.2f} 354 483)'
    head=f'rotate({-2.5+2.7*math.sin(p-.3)+2.5*bop:.2f} 372 273)'
    scarf=f'rotate({-2.2+4.4*math.sin(p-.65):.2f} 411 300)'
    hand=f'rotate({-4.8+7.2*bop:.2f} 171 451)'
    lid=''
    if tick in (21,22,23) and stage in (0,2,4):
        lid='<path d="M310 176l43-3-2 27-41 5Z" fill="#f6d5ae" stroke="none"/><path d="M314 190q15 4 30-6" fill="none" stroke="#263747" stroke-width="2.7"/>'
    s=OP
    for k,v in [('CAM',cam),('BODY',body),('HEAD',head),('SCARF',scarf),('HAND',hand),('LID',lid),('EYE',f'translate({-.45+.65*swing:.2f} 0)')]:s=s.replace('@'+k+'@',v)
    prefix=s[:s.index('<!-- A field jacket')]
    near=s[s.index('<!-- Near sleeve'):]
    arm=prefix+f'<g transform="{body}">'+near
    return draw(s,720,575,scale),draw(arm,720,575,scale)
