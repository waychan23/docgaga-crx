const TITLES = [
    { gte: 0, title: '笔记新手' },
    { gte: 60, title: '笔记能手' },
    { gte: 120, title: '笔记达人' },
    { gte: 240, title: '笔记狂人' },
    { gte: 480, title: '学霸' },
    { gte: 960, title: '学神'}
].reverse();

module.exports.getTitleByNoteCount = getTitleByNoteCount;

function getTitleByNoteCount(count){
    var level, title, i;
    for(i=0;i<TITLES.length;i++){
        level = TITLES[i];
        if(count >= level.gte){
            title = level.title;
            return title;
        }
    }
    return '外星人';
};