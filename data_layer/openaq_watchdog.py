import requests
import json
from datetime import datetime
from time import sleep
from data_layer.api import db
from db.db_model import Openaq
from db.db_model import Sensor
from sqlalchemy import desc

from data_layer.sensors_management import add_sensor
from bigchaindb_driver import BigchainDB
from bigchaindb_driver.crypto import generate_keypair
from data_layer.third_party.openaq import OpenaqInterface

bdb_root_url = 'http://172.17.0.1:9984'
bdb = BigchainDB(bdb_root_url)
tokens = {'app_id': 'openaq_id', 'app_key': 'openaq_key'}
bdb = BigchainDB(bdb_root_url, headers=tokens)

url = "https://api.openaq.org/v1/latest"
airmate = generate_keypair()


def get_latest_data(country, city):
    api_request = "https://api.openaq.org/v1/latest?country=" + country + \
                  "&city=" + city
    raw_data = requests.get(api_request)
    json_data = raw_data.json()
    results = list()
    for location_record in json_data['results']:
        results.append(OpenaqInterface(name=location_record["location"],
                                       city=location_record["city"],
                                       country=location_record['country'],
                                       coordinates=location_record['coordinates'],
                                       measurements=location_record['measurements'])
                       )
    return results


def save_to_bigchain(data):
    metadata = {'data_provider': 'openaq'}
    sensor = {
        'data': {
            'location': data
        }
    }
    prepared_creation_tx = bdb.transactions.prepare(
        operation='CREATE',
        signers=airmate.public_key,
        asset=sensor,
        metadata=metadata,
    )

    fulfilled_creation_tx = bdb.transactions.fulfill(
        prepared_creation_tx, private_keys=airmate.private_key)

    bdb.transactions.send(fulfilled_creation_tx)
    txid = fulfilled_creation_tx['id']

    return txid


def save_to_postgres(provider, sensor_id, txid):
    bdb_transaction = Openaq(sensor_id, txid, datetime.utcnow())
    try:
        db.session.add(bdb_transaction)
        db.session.commit()
    except:
        print("Unable to save transaction ", txid)
        raise
    else:
        return True


def retrieve_from_bigchain(sensor_id):
    bdb_record = Openaq.query.order_by(desc(Openaq.update_time)).filter_by(sensor_id=sensor_id).first()
    postgresdb_record = Sensor.query.filter_by(sensor_id=sensor_id).first()
    return json.dumps({
        "longitude": postgresdb_record.longitude,
        "latitude": postgresdb_record.latitude,
        "data": {
            "transaction": bdb_record.transaction_id,
            "timestamp": str(bdb_record.update_time),
            "measures": bdb_record,
        }
    })


def get_sensors_list():
    return  [x.sensor_id for x in Sensor.query.all()]


if __name__ == '__main__':
    available_sensors_list = get_sensors_list()
    while True:
        city_data = get_latest_data(country="DE", city="Berlin")
        for location in city_data:
            txid = save_to_bigchain(location)
            sensor_id = location.location
            if sensor_id not in available_sensors_list:
                add_sensor(sensor_id,
                           latitude=location.coordinates['latitude'],
                           longitude=location.coordinates['longitude'])
            if save_to_postgres(provider="openaq", sensor_id=sensor_id, txid=txid):
                print("Saved data for sensor_id={}, with transaction={}".format(sensor_id, txid))
            sleep(10)
