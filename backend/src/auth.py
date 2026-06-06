import hashlib
import secrets
import hmac
from src.db import get_db


def generate_salt():
    return secrets.token_hex(16)


def hash_password(password, salt):
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000,
        dklen=64
    )
    return key.hex()


def verify_password(password, salt, stored_hash):
    computed_hash = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, stored_hash)


def register_user(username, password):
    db = get_db()
    try:
        existing = db.table('users').select('id').eq('username', username).execute()
        if existing.data:
            return False, "用户名已存在"

        salt = generate_salt()
        password_hash = hash_password(password, salt)
        db.table('users').insert({
            'username': username,
            'password_hash': password_hash,
            'password_salt': salt
        }).execute()
        return True, "注册成功"
    except Exception as e:
        return False, f"注册失败: {str(e)}"


def login_user(username, password):
    db = get_db()
    try:
        result = db.table('users').select('id, username, password_hash, password_salt').eq('username', username).execute()
        if not result.data:
            return False, "用户名或密码错误", None
        user = result.data[0]
        if not verify_password(password, user['password_salt'], user['password_hash']):
            return False, "用户名或密码错误", None
        return True, "登录成功", user
    except Exception as e:
        return False, f"登录失败: {str(e)}", None
