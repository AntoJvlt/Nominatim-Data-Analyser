from analyser.core.core import Core
import argparse

parser = argparse.ArgumentParser(prog='nominatim-analyser')
parser.add_argument('execute')
args = parser.parse_args()

if args.execute:
    #Core().execute_all()
    Core().execute_one('ways_AB_not_part_relation')