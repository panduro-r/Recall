import io
import json
from types import SimpleNamespace
import pytest
import catalog_sources as source
from test_hosted_app import request


@pytest.fixture(autouse=True)
def no_real_network(monkeypatch):
    source._cache.clear()
    monkeypatch.setattr(source, 'HTTPSConnection', lambda *a, **k: pytest.fail('Unexpected network'))


@pytest.mark.parametrize('data',[{},[],{'provider':'other'},{'provider':'assembly','url':'http://localhost'}, {'provider':['assembly']}, {'provider':'https://example.com'}])
def test_rejects_arbitrary_input(data):
    with pytest.raises(ValueError): source.check(data)


def test_catalog_and_cache(monkeypatch):
    seen=[]
    def fetch(s):
        seen.append(s['url'])
        return {'status':'retrieved','checkedAt':'2026-09-08T20:00:00Z','sha256':'a'*64,'bytes':42}
    monkeypatch.setattr(source,'fetch_source',fetch)
    first=source.check({'provider':'assembly'})
    second=source.check({'provider':'assembly'})
    assert len(seen)==2 and first['cached'] is False and second['cached'] is True
    assert first['sources']==second['sources']
    assert 'not automatically revalidated' in first['meaning']


def test_runtime_catalog_does_not_depend_on_static_output(monkeypatch):
    path_type=type(source.BASE)
    original=path_type.read_text
    monkeypatch.setattr(path_type,'is_file',lambda p:False if p.name=='service-catalog.json' else True)
    def read(p,*args,**kwargs):
        assert p.name=='catalog-data.json'
        return original(source.BASE/'ui'/'service-catalog.json')
    monkeypatch.setattr(path_type,'read_text',read)
    assert len(source.catalog()['plans'])==7


@pytest.mark.parametrize('provider',['speechmatics','soniox','aws'])
def test_expanded_sources_stay_server_owned(monkeypatch,provider):
    seen=[]
    def fetch(s):
        assert s['provider']==provider
        seen.append(s['url'])
        return {'status':'retrieved','checkedAt':'2026-09-09T12:00:00Z','sha256':'b'*64,'bytes':42}
    monkeypatch.setattr(source,'fetch_source',fetch)
    result=source.check({'provider':provider})
    assert result['provider']==provider and len(result['sources'])==2
    assert set(seen)=={s['url'] for s in source.catalog()['sources'].values() if s['provider']==provider}
    assert source.check({'provider':provider})['cached'] is True and len(seen)==2


@pytest.mark.parametrize('status,content_type,data,expected',[(200,'text/html',b'hello','retrieved'),(302,'text/html',b'','unavailable'),(200,'image/png',b'x','unavailable'),(200,'text/plain',b'','unavailable'),(200,'text/markdown',b'x'*100,'unavailable')])
def test_bounded_fetch_and_no_redirect(monkeypatch,status,content_type,data,expected):
    monkeypatch.setattr(source,'MAX_BYTES',50)
    closed=[]
    response=SimpleNamespace(status=status,getheader=lambda *a:content_type,read1=io.BytesIO(data).read)
    class Connection:
        def __init__(self,host,timeout): assert host=='deepgram.com' and timeout==6
        def request(self,method,path,headers): assert method=='GET' and path=='/pricing' and headers['Accept-Encoding']=='identity'
        def getresponse(self):return response
        def close(self):closed.append(True)
    monkeypatch.setattr(source,'HTTPSConnection',Connection)
    result=source.fetch_source(source.catalog()['sources']['deepgram-price'])
    assert result['status']==expected and closed==[True]
    if expected=='retrieved':assert len(result['sha256'])==64 and result['bytes']==5


def test_timeout_is_not_success(monkeypatch):
    class Connection:
        def __init__(self,*a,**k):pass
        def request(self,*a,**k):raise TimeoutError()
        def close(self):pass
    monkeypatch.setattr(source,'HTTPSConnection',Connection)
    assert source.fetch_source(source.catalog()['sources']['deepgram-price'])['status']=='unavailable'


@pytest.mark.parametrize('body,headers,status',[(b'{"provider":"assembly","url":"https://evil.test"}',{},400),(b'{"provider":"assembly"}',{'Origin':'https://evil.test'},403),(b'{}',{'Content-Type':'text/plain'},400),(b'{}',{'Transfer-Encoding':'chunked'},400)])
def test_hosted_source_guards(monkeypatch,body,headers,status):
    assert request(monkeypatch,'/api/catalog/check','POST',body,headers)[0]==status


def test_hosted_and_local_route(monkeypatch):
    from server import Handler
    monkeypatch.setattr(source,'check',lambda data:{'provider':data['provider'],'sources':{},'cached':False})
    body=b'{"provider":"assembly"}'
    assert request(monkeypatch,'/api/catalog/check','POST',body)[0]==200
    h=object.__new__(Handler);h.path='/api/catalog/check';h.server=SimpleNamespace(server_port=4183)
    h.headers={'Host':'localhost:4183','Origin':'http://localhost:4183','Content-Type':'application/json','Content-Length':str(len(body))};h.rfile=io.BytesIO(body)
    result=[];h.reply=lambda status,data:result.append((status,json.loads(data)))
    h.do_POST();assert result[0][0]==200


@pytest.mark.parametrize('path',['/','/compare','/compare.css','/compare.js','/compare-model.js','/service-catalog.json'])
def test_local_static_routes(path):
    from server import Handler
    h=object.__new__(Handler);h.path=path;h.server=SimpleNamespace(server_port=4183);h.headers={'Host':'localhost:4183'}
    results=[];h.reply=lambda status,data,kind:results.append((status,data,kind));h.do_GET()
    assert results[0][0]==200 and results[0][1]
