package qps

// copied from https://github.com/zengming00/go-qps

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"sync"
	"time"
)

type Count struct {
	Time        string
	Count       uint64
	MethodCount map[string]uint64
}

type QP struct {
	mu      sync.Mutex
	count   []*Count
	sample  time.Duration
	keepNum int
}

func (ths *QP) GetJson() ([]byte, error) {
	ths.mu.Lock()
	defer ths.mu.Unlock()
	return json.Marshal(ths.count)
}

func (ths *QP) Show() (string, error) {
	bts, err := ths.GetJson()
	if err != nil {
		return "", err
	}
	base64Data := base64.StdEncoding.EncodeToString(bts)
	return strings.Replace(htmlTpl, "${DATA}", base64Data, 1), nil
}

func (ths *QP) Count(method string) {

	var idx int
	var timeStr string
	var now = time.Now()
	switch ths.sample {
	case time.Hour:
		idx = int(now.Unix()/60/60) % ths.keepNum
		timeStr = now.Format("2006-01-02 15")
	case time.Minute:
		idx = int(now.Unix()/60) % ths.keepNum
		timeStr = now.Format("2006-01-02 15:04")
	case time.Second:
		idx = int(now.Unix()) % ths.keepNum
		timeStr = now.Format("2006-01-02 15:04:05")
	}
	ths.mu.Lock()
	defer ths.mu.Unlock()
	c := ths.count[idx]
	if c.Time != timeStr {
		c.Time = timeStr
		c.MethodCount = make(map[string]uint64)
		c.Count = 1
		c.MethodCount[method] = 1
	} else {
		c.Count++
		c.MethodCount[method] = c.MethodCount[method] + 1
	}
}

func NewQP(sample time.Duration, keepNum int) *QP {
	var count = make([]*Count, keepNum)
	for i := range count {
		count[i] = &Count{
			MethodCount: map[string]uint64{},
		}
	}
	return &QP{sample: sample, keepNum: keepNum, count: count}
}

const htmlTpl = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ECharts</title>
	<script src="https://cdn.jsdelivr.net/gh/maggch97/VideoTogether@main/source/go-server/internal/qps/qps.js"></script>
    <style>
        html,body{ height: 100% }
    </style>
</head>
<body>
<input type="checkbox" id="chk1" onclick="chk1(this);"> <label for="chk1">autoRefresh</label>
<button onclick="getData()">refresh</button>
<span id="msg"></span>
<span id="info"></span>
<div id="main" style="height:80%"></div>
<script type="text/javascript">
var myChart = echarts.init(document.getElementById('main'));
function show(data){
	data = JSON.parse(data);
	data = data.filter(function(v){return v.Time})
	data.sort(function(a,b){return a.Time===b.Time?0:a.Time>b.Time?1:-1})
	data.pop();
	data.shift();
	var xdata = [];
	var ydata = [];
	var methodYdata = {}
	data.forEach(v=>{
		for(const method in v.MethodCount){
			if(methodYdata[method]==null){
				methodYdata[method] = []
			}
		}
	})

	data.forEach(function(v){
		xdata.push(v.Time);
		ydata.push(v.Count);
		for(const method in methodYdata){
			if(v.MethodCount[method] == null){
				v.MethodCount[method] = 0;
			}
			methodYdata[method].push(v.MethodCount[method]);
		}
	})
	var methodYdataList = []
	var legend = ['total']
	for(const method in methodYdata){
		methodYdataList.push([method,methodYdata[method]]);
		legend.push(method);
	}
	if(data.length){
		var max = data[0];
		var min = data[0];
		var sum = 0;
		for(var i=data.length-1; i>=0; i--){
			var v = data[i];
			if(max.Count < v.Count){
				max = v;
			}
			if(min.Count > v.Count){
				min = v;
			}
			sum += v.Count;
		}
		var info = document.getElementById('info');
		info.innerHTML = 'max:' + max.Count + '  ' + max.Time+ ', min:' + min.Count + '  ' + min.Time + ', avg:' + (Math.floor(sum/data.length))
	}
	var option = {
		xAxis: {
			type: 'category',
			data: xdata,
		},
		yAxis: {
			type: 'value'
		},
		legend:{
			data:legend
		},
		tooltip: {
			trigger: 'axis',
		},
		dataZoom: [{
			type: 'inside',
			start: 0,
			end: 100
		}, {
			start: 0,
			end: 10,
			handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z M13.3,24.4H6.7V23h6.6V24.4z M13.3,19.6H6.7v-1.4h6.6V19.6z',
			handleSize: '80%',
			handleStyle: {
			color: '#fff',
			shadowBlur: 3,
			shadowColor: 'rgba(0, 0, 0, 0.6)',
			shadowOffsetX: 2,
			shadowOffsetY: 2
			}
		}],
		series: [...(methodYdataList.map(d=>({
			name: d[0],
			data: d[1],
			type: 'line',
			smooth: true
		}))),{
			name: 'total',
			data: ydata,
			type: 'line',
			smooth: true
		}]
	};
	myChart.setOption(option);
}
function getData(cb){
	var url = location.pathname + '_json';
	var req = new XMLHttpRequest();
	var msg = document.getElementById('msg');
	msg.innerHTML = 'loading...';
	req.onreadystatechange = function() {
		if (req.readyState==4){
			if(req.status==200) {
				var data = req.responseText;
				show(data);
				msg.innerHTML = '<span style="color:green">refresh success</span>';
				cb && cb();
			}else{
				msg.innerHTML = '<span style="color:red">refresh failed</span>';
			}
		}
	}
	req.open("GET", url, true);
	req.send();
}
var autoUpdate = false;
function update(){
	if(autoUpdate){
		getData(function(){
			setTimeout(update, 3000)
		});
	}
}
function chk1(t){
	autoUpdate=t.checked;
	update();
}
var data = '${DATA}';
data = atob(data);
show(data);
</script>
</body>
</html>`
