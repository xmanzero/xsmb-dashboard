__author__ = 'Khiem Doan'
__github__ = 'https://github.com/khiemdoan'
__email__ = 'doankhiem.crazy@gmail.com'

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from lottery import Lottery

if __name__ == '__main__':
    lottery = Lottery()
    lottery.load()

    # Download new data

    begin_date = lottery.get_last_date()
    tz = ZoneInfo('Asia/Ho_Chi_Minh')
    now = datetime.now(tz)
    last_date = now.date()
    if now.time() < time(18, 35):
        last_date -= timedelta(days=1)

    delta = (last_date - begin_date).days + 1
    for i in range(1, delta):
        selected_date = begin_date + timedelta(days=i)
        print(f'Fetching: {selected_date}')
        try:
            if not lottery.fetch(selected_date):
                print(f'No result published for {selected_date}')
        except Exception as e:
            # Stop instead of skipping the day: the next run starts again from the last saved date,
            # so this day is retried. Days fetched before it are still saved below.
            print(f'::warning::Could not fetch {selected_date}, will retry on the next run: {e!r}')
            break

    lottery.generate_dataframes()
    lottery.dump()
