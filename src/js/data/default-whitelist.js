
const COMM = [
    { name: "Stack Overflow", url: "stackoverflow.com", type: "site" },
    { name: "SegmentFault", url: "segmentfault.com", type: "site" },
    { name: "维基百科", url: "wikipedia.org", type: "site" }
];

const BLOG = [
    { name: "博客园", url: "cnblogs.com", type: "site" },
    { name: "CSDN", url: "csdn.net", type: "site" },
    { name: "简书", url: "jianshu.com", type: "site" },
    { name: "伯乐在线", url: "jobbole.com", type: "site" }
];

const DOC = [
    { name: "Google Developer", url: "developer.google.com", type: "site" },
    { name: "Facebook Developer", url: "developer.facebook.com", type: "site" },
    { name: "菜鸟教程", url: "runoob.com", type: "site" }
];

const OPENSOURCE = [
    { name: "Google OpenSource", url: "opensource.google.com", type: "site" },    
    { name: "开源中国", url: "oschina.net", type: "site" },
    { name: "GitHub", url: "github.com", type: "site" },
    { name: "Github.IO", url: "github.io", type: "site" },
    { name: "Google Code", url: "code.google.com", type: "site" },
    { name: "Facebook Code", url: "code.facebook.com", type: "site" },
    { name: "Apache软件基金会", url: "apache.org", type: "site" }    
];

module.exports = [BLOG, DOC, COMM, OPENSOURCE].reduce(function(a, b){
    return a.concat(b);
});