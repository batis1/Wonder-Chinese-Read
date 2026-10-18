"""Remove glossary overflow and scan artifacts identified against the course PDFs."""
import json
import re
from prepare import DATA, write_json

for file in sorted((DATA/'raw').glob('*.json')):
    l=json.loads(file.read_text(encoding='utf-8'))
    text=l['text']
    # Some glossary panels extend below the passage into its column.
    text=re.split(r'1[.．]?(?:子路|济南|西汉|加利福尼亚|微信|战国|诺贝尔奖|理查德|刘辰|佩)',text)[0]
    if l['number']==9:
        text=text.split('••')[0]
        text=text.replace('资籵','资料').replace('蒙胧','朦胧').replace('彷惶','彷徨')
        text=text.replace('＂醉眼朦胧上酒楼，彷徨呐喊两悠悠"\'','“醉眼朦胧上酒楼，彷徨呐喊两悠悠”，')
    if l['number']==17:
        text=text.removesuffix('豪森，陈晓川译')
    if l['number']==6:
        text=text.removesuffix('2.七郎')
    if l['number']==18:
        text=text.replace('哪一幅。签名','哪一幅。\n其中三分之一的画作作者没有签名')
        text=text.replace('故意弄错了，有可能','故意弄错了，志愿者无法确认作者到底是谁，所以有可能')
    if l['number']==20:
        text=text.removeprefix('生词\n')
    if l['number']==24:
        text=text.removesuffix('题目自拟')
    if l['number']==21:
        text=text.replace('無车更让人佩服','更让人佩服')
        text=text.replace('我要“活到老，学到老”。','我要‘活到老，学到老’。”')
    if l['number']==34:
        text=re.sub(r'而另一些鸟.*?用睡。$','而另一些鸟儿几乎一点儿觉也不用睡。',text)
    if l['number']==29:
        text=text.replace('把另三家书店挤，','把另三家书店挤垮，').replace('没有了比交','没有了比较')
        text=text.replace('维寺这种','维持这种').replace('我把其也三家都挤了','我把其他三家都挤垮了')
    if l['number']==36:
        text=text.removesuffix('老舍')
    if text!=l['text']:
        print(l['id'],len(l['text']),'=>',len(text),flush=True)
        l['text']=text.rstrip()
        write_json(file,l)
