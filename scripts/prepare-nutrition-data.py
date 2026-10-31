"""Rebuild the checked-in nutrition subset from the official USDA SR Legacy CSV.
Run from the project root. Facts are per 100 g, not per portion. No credentials.
"""
import csv
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip'
cache = Path('.local-data/sr-legacy.zip')
cache.parent.mkdir(exist_ok=True)
if not cache.exists():
    urllib.request.urlretrieve(URL, cache)
archive = zipfile.ZipFile(cache)

def rows(name):
    file = next(n for n in archive.namelist() if n.endswith('/' + name))
    return csv.DictReader(io.TextIOWrapper(archive.open(file), encoding='utf-8-sig'))

mapping = {
    'white-rice-cooked':168932, 'white-rice-raw':168931, 'brown-rice':169703,
    'rice-flour':169714, 'oats':169705, 'millet':169702, 'quinoa':168874, 'amaranth':170682,
    'carrot':170393, 'broccoli':170379, 'cauliflower':169986, 'spinach':168462,
    'onion':170000, 'cabbage':169975, 'cucumber':168409, 'eggplant':169228,
    'garlic':169230, 'potato':170026, 'sweet-potato':168482, 'tomato':170457,
    'green-peas':170419, 'shiitake-mushroom':169242, 'bok-choy':170390,
    'apple':171689, 'banana':173944, 'strawberry':167762,
    'chicken-breast':171077, 'tofu':172476, 'soft-tofu':172449,
    'egg':171287, 'milk':172217, 'yogurt-plain':171284,
    'water':173647, 'sesame-oil':171016, 'olive-oil':171413, 'canola-oil':172336,
}
nutrients = {'1008':'energy','1003':'protein','1004':'fat','1005':'carbohydrate','1089':'iron','1087':'calcium','1093':'sodium','1079':'fiber'}
foods = {int(r['fdc_id']):r for r in rows('food.csv')}
selected = set(mapping.values())
values = {i:{n:None for n in nutrients.values()} for i in selected}
for r in rows('food_nutrient.csv'):
    code = int(r['fdc_id'])
    if code in selected and r['nutrient_id'] in nutrients and r['amount']:
        values[code][nutrients[r['nutrient_id']]] = float(r['amount'])
result = {}
for slug, code in mapping.items():
    result[slug] = {'foodCode':str(code), 'description':foods[code]['description'],
        'source':'USDA FoodData Central · SR Legacy 2018', 'sourceUrl':'https://fdc.nal.usda.gov/download-datasets/',
        'version':'SR Legacy April 2018 / FDC 2019-04-01',
        'basis':'100g edible ingredient; standard reference food, product and variety differences apply',
        'per100g':values[code]}
Path('src/data').mkdir(exist_ok=True)
Path('src/data/food-composition.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'foods':len(result),'archiveSha256':hashlib.sha256(cache.read_bytes()).hexdigest()}))
