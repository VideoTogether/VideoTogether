FROM python:alpine3.16

COPY . /app
RUN pip install -r /app/requirements.txt

ENTRYPOINT ["/app/entrypoint.sh"]
