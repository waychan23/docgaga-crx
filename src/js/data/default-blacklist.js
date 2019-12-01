const ECOMMERCE = [
    { "name": "一淘网", "url": "etao.com", type:"site" },
    { "name": "淘宝", "url": "taobao.com", "type":"site" },
    { "name": "天猫", "url": "tmall.com", "type": "site" },
    { "name": "京东", "url": "jd.com", "type": "site" },
    { "name": "苏宁", "url": "suning.com", "type": "site" },
    { "name": "阿里巴巴", "url": "1688.com", "type": "site" },
    { "name": "当当", "url": "dangdang.com", "type": "site" },
    { "name": "亚马逊", "url": /(https?)?([^\/]+\.)?amazon\.[^\/]+/i, "type": "regex" },
    { "name": "ebay", "url": /(https?)?([^\/]+\.)?ebay\.[^\/]+/i, "type": "regex" }
];

const IPADDR = [
    { "name": "通过IP地址访问的页面", "url": /^(https?:\/\/)?((1[0-9][0-9]\.)|(2[0-4][0-9]\.)|(25[0-5]\.)|([1-9][0-9]\.)|([0-9]\.)){3}((1[0-9][0-9])|(2[0-4][0-9])|(25[0-5])|([1-9][0-9])|([0-9]))/i.source, type:"regex" }
];

const MEDIA = [
    { "name": "多媒体文件", "url": /\.(jpg|gif|png|mp3|mp4|ogg|svg)$/i.source, type:"regex" }
];

const GOV = [
    { "name":"政府网站", "url": /^(https?:\/\/)?[^\/]+.gov.cn/i.source, type:"regex" }
];

const MAP = [
    { "name": "百度地图", "url": "map.baidu.com", "type": "site" },
    { "name": "腾讯地图", "url": "map.qq.com", "type": "site" },
    { "name": "高德地图", "url": "amap.com", "type": "site" },
    { "name": "谷歌地图", "url": /\.google\.com(\.[a-z]+)?\/maps/i.source, "type": "regex" }
];

const SE = [
    { "name": "百度搜索", "url": "baidu.com/s", "type": "prefix" },
    { "name": "谷歌搜索", "url": /\.google.com(\.[a-z]+)?\/search/i.source, "type": "regex" },
    { "name": "必应搜索", "url": "bing.com/search", "type": "prefix" },
    { "name": "搜狗搜索", "url": "sogou.com/web", "type": "prefix" },
    { "name": "雅虎搜索", "url": "yahoo.com/search", "type": "prefix" }
];

const BANK = [
    {"name":"中国工商银行","url":"icbc.com.cn","type":"site"},
    {"name":"中国建设银行","url":"ccb.com","type":"site"},
    {"name":"中国银行","url":"boc.cn","type":"site"},
    {"name":"交通银行","url":"bankcomm.com","type":"site"},
    {"name":"中国农业银行","url":"abchina.com","type":"site"},
    {"name":"招商银行","url":"cmbchina.com","type":"site"},
    {"name":"中国邮政储蓄银行","url":"psbc.com","type":"site"},
    {"name":"中国光大银行","url":"cebbank.com","type":"site"},
    {"name":"中国民生银行","url":"cmbc.com.cn","type":"site"},
    {"name":"平安银行","url":"pingan.com","type":"site"},
    {"name":"浦发银行","url":"spdb.com.cn","type":"site"},
    {"name":"中信银行","url":"bank.ecitic.com","type":"site"},    
    {"name":"兴业银行","url":"cib.com.cn","type":"site"},        
    {"name":"华夏银行","url":"hxb.com.cn","type":"site"},        
    {"name":"广发银行","url":"cgbchina.com.cn","type":"site"},    
    //--
    {"name":"山东省农村信用社","url":"sdnxs.com","type":"site"},
    {"name":"河南农村信用社","url":"hnnx.com","type":"site"},
    {"name":"江苏农村信用社联合社","url":"js96008.com","type":"site"},
    {"name":"吉林省农村信用社","url":"jlnls.com","type":"site"},
    {"name":"河北省农村信用社","url":"hebnx.com","type":"site"},
    {"name":"内蒙古农村信用社","url":"nmgnxs.com.cn","type":"site"},
    {"name":"辽宁省农村信用社","url":"lnrcc.com","type":"site"},
    {"name":"云南省农村信用社","url":"ynrcc.com","type":"site"},
    {"name":"湖北农村信用社","url":"hbxh.com.cn","type":"site"},
    {"name":"广东农村信用社","url":"gdrcu.com","type":"site"},
    {"name":"海南省农村信用社","url":"hainanbank.com.cn","type":"site"},
    {"name":"山西农村信用社","url":"shanxinj.com","type":"site"},
    {"name":"安徽农村信用社联合社","url":"ahrcu.com","type":"site"},
    {"name":"湖南农村信用联合社","url":"hnnxs.com","type":"site"},
    {"name":"四川农村信用社","url":"scrcu.com.cn","type":"site"},
    {"name":"浙江农信","url":"zj96596.com","type":"site"},
    {"name":"广西农村信用社","url":"gx966888.com","type":"site"},
    {"name":"陕西农村信用社 ","url":"sxnxs.com","type":"site"},
    {"name":"福建农村信用社 ","url":"fjnx.com.cn","type":"site"},
    {"name":"甘肃省农村信用社","url":"gsrcu.com","type":"site"},
    {"name":"江西农村信用社","url":"jxnxs.com","type":"site"},
    {"name":"黑龙江农村信用社","url":"hljrcc.com","type":"site"},
    //--
    {"name":"北京银行","url":"bankofbeijing.com.cn","type":"site"},
    {"name":"徽商银行","url":"hsbank.com.cn","type":"site"},
    {"name":"天津银行","url":"tccb.com.cn","type":"site"},
    {"name":"深圳农村商业银行","url":"4001961200.com","type":"site"},
    {"name":"上海银行","url":"bankofshanghai.com","type":"site"},
    {"name":"汉口银行","url":"hkbchina.com","type":"site"},
    {"name":"南京银行","url":"njcb.com.cn","type":"site"},
    {"name":"宁波银行","url":"nbcb.com.cn","type":"site"},
    {"name":"龙江银行","url":"lj-bank.com","type":"site"},
    {"name":"北京农商银行","url":"bjrcb.com","type":"site"},
    {"name":"江苏银行","url":"jsbchina.cn","type":"site"},
    {"name":"广州银行","url":"gzcb.com.cn","type":"site"},
    {"name":"重庆银行","url":"cqcbank.com","type":"site"},
    {"name":"浙商银行","url":"czbank.com","type":"site"},
    {"name":"杭州银行","url":"hzbank.com.cn","type":"site"},
    {"name":"上海农商银行","url":"srcb.com","type":"site"},
    {"name":"渤海银行","url":"cbhb.com.cn","type":"site"},
    {"name":"重庆农村商业银行","url":"cqrcb.com","type":"site"},
    {"name":"广州农村商业银行","url":"grcbank.com","type":"site"},
    {"name":"青岛银行","url":"qdccb.com","type":"site"},
    {"name":"成都银行","url":"bocd.com.cn","type":"site"},
    {"name":"哈尔滨银行","url":"hrbcb.com.cn","type":"site"},
    {"name":"吉林银行","url":"jlbank.com.cn","type":"site"},
    {"name":"大连银行","url":"bankofdl.com","type":"site"},
    {"name":"齐鲁银行","url":"qlbchina.com","type":"site"},
    {"name":"东莞银行","url":"dongguanbank.cn","type":"site"},
    {"name":"长沙银行","url":"cscb.cn","type":"site"},
    {"name":"河北银行","url":"hebbank.com","type":"site"},
    {"name":"东莞农村商业银行","url":"drcbank.com","type":"site"},
    {"name":"郑州银行","url":"zzbank.cn","type":"site"},
    {"name":"包商银行","url":"bsb.com.cn","type":"site"},
    //--
    {"name":"中国人民银行","url":"pbc.gov.cn","type":"site"},
    {"name":"银监会","url":"cbrc.gov.cn","type":"site"},
    {"name":"中国银联","url":"cn.unionpay.com","type":"site"},
    {"name":"国家开发银行","url":"cdb.com.cn","type":"site"},
    {"name":"中国农业发展银行","url":"adbc.com.cn","type":"site"},
    {"name":"Visa卡官网","url":"visa.com.cn","type":"site"},
    {"name":"MasterCard","url":"mastercard.com","type":"site"},
    {"name":"JCB卡","url":"jcbcard.cn","type":"site"},
    //--
    {"name":"支付宝","url":"alipay.com","type":"site"},
    {"name":"百度钱包","url":"baifubao.com","type":"site"},
    {"name":"易宝支付","url":"yeepay.com","type":"site"},
    {"name":"快钱","url":"99bill.com","type":"site"},
    {"name":"银联在线支付","url":"online.unionpay.com","type":"site"},
    {"name":"我爱卡","url":"51credit.com","type":"site"},
    {"name":"移动和包","url":"cmpay.com","type":"site"},
    {"name":"财付通","url":"tenpay.com","type":"site"},
    {"name":"拉卡拉","url":"lakala.com","type":"site"},
    {"name":"网易支付","url":"epay.163.com","type":"site"},
    {"name":"Apple Pay","url":"apple.com/cn/apple-pay","type":"prefix"},
    {"name":"京东钱包","url":"jdpay.com","type":"site"},
    {"name":"微信支付","url":"pay.weixin.qq.com",type:"site"},
    {"name":"PayPal","url":"paypal.com",type:"site"},
    //--
    {"name":"花旗银行","url":"citibank.com.cn","type":"site"},
    {"name":"汇丰银行","url":"personal.hsbc.com.cn","type":"site"},
    {"name":"渣打银行","url":"sc.com","type":"site"},
    {"name":"东亚银行","url":"hkbea.com.cn","type":"site"}
];

module.exports = [ECOMMERCE, IPADDR, MEDIA, MAP, SE, GOV, BANK].reduce(function(a, b){
    return a.concat(b);
});
