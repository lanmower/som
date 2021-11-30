const fs = require('fs');
let votes = 0;

const getRc = async (account, props) => {
    var CURRENT_UNIX_TIMESTAMP = parseInt((new Date(props.time).getTime() / 1000).toFixed(0))
    var totalShares = parseFloat(account.vesting_shares) + parseFloat(account.received_vesting_shares) - parseFloat(account.delegated_vesting_shares);
    var elapsed = CURRENT_UNIX_TIMESTAMP - account.voting_manabar.last_update_time;
    var maxMana = totalShares * 1000000;
    //if (parseFloat(account.voting_manabar.current_mana) < 160409289) return 0;
    var currentMana = parseFloat(account.voting_manabar.current_mana) + elapsed * maxMana / 432000;
    if (currentMana > maxMana) {
        currentMana = maxMana;
    }
    var currentManaPerc = currentMana * 100 / maxMana;
    if (currentMana == 0 || maxMana == 0) return 0;
    else return currentManaPerc;
}

const getValue = async (account, fund, price) => {
    const total_vests = parseFloat(account.vesting_shares.split(' ')[0]) + parseFloat(account.received_vesting_shares.split(' ')[0]) - parseFloat(account.delegated_vesting_shares.split(' ')[0]);
    const final_vest = total_vests * 1e6;
    const power = (account.voting_power * 100 / 10000) / 50;
    const rshares = power * final_vest / 10000;
    const estimate = rshares / parseFloat(fund.recent_claims) * parseFloat(fund.reward_balance.split(' ')[0]) * price;
    return estimate;
}

setTimeout(()=>{
    process.exit();
},90000)
const run = async () => {
    let props = await chain.api.getDynamicGlobalPropertiesAsync()
    let price = parseFloat((await chain.api.getCurrentMedianHistoryPriceAsync()).base.split(' ')[0])
    let fund = await chain.api.getRewardFundAsync('post');
    const members = fs.readdirSync('member-' + vest);

    const pindexes = fs.readdirSync('post-' + vest);
    const posts = [];
    for (const pindex of pindexes) {
        if(new Date().getTime() > pindex+604800000) {
            fs.unlinkSync('post-' + vest + '/' + pindex);
            continue;
        }
        const post = JSON.parse(fs.readFileSync('post-' + vest + '/' + pindex));
        if(!post.author) {
            fs.unlinkSync('post-' + vest + '/' + pindex);
            continue;
        }
        const posteraltruism = fs.existsSync('altruism-' + vest + '/' + post.author) ? JSON.parse(fs.readFileSync('altruism-' + vest + '/' + post.author)) : { up: 0, down: 0 };
        posts.push({ post, pindex, posteraltruism });
    }
    posts.sort((a, b) => { return (b.posteraltruism.up - b.posteraltruism.down)-(a.posteraltruism.up - a.posteraltruism.down) });
    const dopost = async (data, props) => {
        const { posteraltruism, pindex } = data;
        if (new Date().getTime() - data.post.last_round < (1000 * 60 * 15)) {
            return;
        }
        const post = await chain.api.getContentAsync(data.post.author, data.post.permlink);
        post.last_round = new Date().getTime();
        fs.writeFileSync('post-' + vest + '/' + pindex, JSON.stringify(post));
        const smembers = members.sort((a, b) => 0.5 - Math.random());
        for (let name of smembers) {
            if (post.active_votes.filter(a => { return a.voter == name }).length) {
                continue;
            }
            if (post.author == name) {
                continue;
            }
            if (new Date().getTime() - parseInt(pindex) < (60000 * 15)) {
                continue;
            }
            try {
                const memberData = JSON.parse(fs.readFileSync('member-' + vest + '/' + name));
                if (await getRc(memberData, props) < 98) {
                    continue;
                }
            } catch (e) { 
                console.error(e);
            }
            var authed = false;
            const account = (await chain.api.getAccountsAsync([name]))[0];
            if(account.posting.account_auths.length) {
                for(let auth of account.posting.account_auths) {
                    if(auth[0] == 'minnowschool') {
                        authed = true;
                    }
                }
            }
            if(!authed) {
                fs.unlinkSync("member-"+vest+"/"+account.name);
                continue;
            }

            if(new Date().getTime() - new Date(account.last_vote_time).getTime() < 6000) {
                continue;
            }
            fs.writeFileSync('member-' + vest + '/' + name, JSON.stringify(account));
            if (await getRc(account, props) < 98) {
                continue;
            }
            if (post.active_votes.filter(a => { return a.voter == account.name }).length) {
                continue;
            }
            const value = await getValue(account, fund, price);

            const rc = await client.rc.getRCMana(account.name);
            const vp = await client.rc.getVPMana(account.name);
            if(rc.current_mana < 180000000) continue;
            if(vp.current_mana < 180000000) continue;

            let weight = 10000;
            if (value > 0.10) {
                weight = (1 / (value / 0.10)) * 10000;
                if (weight < 500) weight = 500;
            }

            const op = [
                'vote',
                {
                    "voter": name,
                    "author": post.author,
                    "permlink": post.permlink,
                    "weight": parseInt(weight)
                },
            ];
            await client.broadcast.sendOperations([op], k);
            let voteraltruism = fs.existsSync('altruism' + vest + '/' + name) ? JSON.parse(fs.readFileSync('altruism-' + vest + '/' + name)) : { up: 0, down: 0 };
            voteraltruism.up = parseFloat(voteraltruism.up) + (value * weight) / 100;
            posteraltruism.down = parseFloat(posteraltruism.down) + (value * weight) / 100;
            fs.writeFileSync('altruism-' + vest + '/' + name, JSON.stringify(voteraltruism));
            fs.writeFileSync('altruism-' + vest + '/' + post.author, JSON.stringify(posteraltruism));
            account.last_vote_time = new Date().getTime();
            fs.writeFileSync('member-' + vest + '/' + name, JSON.stringify(account));
            console.log('voted',post.permlink, post.author, 'as', name);
            await new Promise(res=>setTimeout(res,3000))
            if(votes>10)return true;
        }
    }
    try {
        for (const data of posts) {
            try {
                if(await dopost(data,props)) return;
            } catch (e) {
                console.error(e);
            }
        }
    } catch(e) {
        console.error(e);
    }
    setTimeout(()=>{process.exit(0)}, votes?0:30000);
}
run();