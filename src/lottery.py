__author__ = 'Khiem Doan'
__github__ = 'https://github.com/khiemdoan'
__email__ = 'doankhiem.crazy@gmail.com'

from copy import copy
from datetime import date

import numpy as np
import pandas as pd
from bs4 import BeautifulSoup
from cloudscraper import CloudScraper
from requests import Response
from tenacity import retry, stop_after_attempt, wait_exponential

from dtos import Result, ResultList

# CSS class on xoso.com.vn -> (number of prizes, digits per prize, Result field prefix)
PRIZE_LAYOUT = {
    'special-prize': (1, 5, 'special'),
    'prize1': (1, 5, 'prize1'),
    'prize2': (2, 5, 'prize2'),
    'prize3': (6, 5, 'prize3'),
    'prize4': (4, 4, 'prize4'),
    'prize5': (6, 4, 'prize5'),
    'prize6': (3, 3, 'prize6'),
    'prize7': (4, 2, 'prize7'),
}


class IncompleteResultError(Exception):
    """The page exists but not every prize has been drawn yet (live draw in progress)."""


def parse_result(html: str, selected_date: date) -> Result | None:
    """
    Parses a result page. Returns None when the page has no result at all, and raises
    IncompleteResultError when some prizes are missing or still show placeholders.
    """
    soup = BeautifulSoup(html, 'lxml')
    fields: dict[str, int] = {}
    for css_class, (count, digits, prefix) in PRIZE_LAYOUT.items():
        texts = [p.text.strip() for p in soup.find_all(attrs={'class': css_class})][:count]
        if css_class == 'special-prize' and not texts:
            return None
        if len(texts) < count or any(not (t.isdigit() and len(t) == digits) for t in texts):
            raise IncompleteResultError(f'{selected_date}: {css_class} = {texts}')
        for i, text in enumerate(texts):
            fields[prefix if count == 1 else f'{prefix}_{i + 1}'] = int(text)
    return Result(date=selected_date, **fields)


class Lottery:
    def __init__(self) -> None:
        self._http = CloudScraper()

        self._data: dict[date, Result] = {}

        self._raw_data: pd.DataFrame = pd.DataFrame()
        self._2_digits_data: pd.DataFrame = pd.DataFrame()
        self._sparse_data: pd.DataFrame = pd.DataFrame()

        self._begin_date = date.today()
        self._last_date = date.today()

    def load(self) -> None:
        with open('data/xsmb.json', 'r', encoding='utf-8') as f:
            data = ResultList.model_validate_json(f.read())
        for d in data.root:
            self._data[d.date] = d

        self.generate_dataframes()

    def dump(self) -> None:
        def _dump(df: pd.DataFrame, file_name: str) -> None:
            df.to_csv(f'data/{file_name}.csv', index=False)
            df.to_json(f'data/{file_name}.json', orient='records', date_format='iso', indent=2, index=False)
            df.to_parquet(f'data/{file_name}.parquet', index=False)

        _dump(self._raw_data, 'xsmb')
        _dump(self._2_digits_data, 'xsmb-2-digits')
        _dump(self._sparse_data, 'xsmb-sparse')

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=5, max=60), reraise=True)
    def _download(self, url: str) -> Response:
        """GET with retries on network errors and 5xx responses; other status codes are returned as is."""
        resp = self._http.get(url, timeout=30)
        if resp.status_code >= 500:
            resp.raise_for_status()
        return resp

    def fetch(self, selected_date: date) -> bool:
        """
        Downloads the result of one day. Returns False when no result is published for that day
        (no draw, or not drawn yet). Raises IncompleteResultError while the draw is still in progress.
        """
        url = f'https://xoso.com.vn/xsmb-{selected_date:%d-%m-%Y}.html'
        resp = self._download(url)
        if resp.status_code != 200:
            return False
        result = parse_result(resp.text, selected_date)
        if result is None:
            return False
        self._data[result.date] = result
        return True

    def generate_dataframes(self) -> None:
        self._raw_data = pd.DataFrame([d.model_dump() for d in self._data.values()])
        self._raw_data['date'] = pd.to_datetime(self._raw_data['date'])
        self._raw_data.iloc[:, 1:] = self._raw_data.iloc[:, 1:].astype('int64')

        self._2_digits_data = copy(self._raw_data)
        self._2_digits_data.iloc[:, 1:] = self._2_digits_data.iloc[:, 1:].apply(lambda x: x % 100)

        self._sparse_data = pd.concat(
            [
                self._2_digits_data.iloc[:, 0:1],
                pd.DataFrame(np.zeros((self._2_digits_data.shape[0], 100), dtype=int)),
            ],
            axis=1,
        )
        self._sparse_data.iloc[:, 1:] = self._sparse_data.iloc[:, 1:].astype('int64')
        for i in range(self._2_digits_data.shape[0]):
            counts = self._2_digits_data.iloc[i, 1:].value_counts()
            for k, v in counts.items():
                self._sparse_data.iloc[i, k + 1] = int(v)

        begin_date = self._raw_data['date'].min()
        self._begin_date = begin_date.to_pydatetime().date()
        last_date = self._raw_data['date'].max()
        self._last_date = last_date.to_pydatetime().date()

    def get_raw_data(self) -> pd.DataFrame:
        return self._raw_data

    def get_2_digits_data(self) -> pd.DataFrame:
        return self._2_digits_data

    def get_sparse_data(self) -> pd.DataFrame:
        return self._sparse_data

    def get_last_date(self) -> date:
        return self._last_date
