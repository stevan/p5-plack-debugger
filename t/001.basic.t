#!/usr/bin/perl

use strict;
use warnings;

use Test::More;

use Plack::Builder;

use Plack::Test::Debugger;    
use HTTP::Request::Common qw[ GET ];
use Path::Class           qw[ dir ];
use UUID::Tiny            qw[ create_uuid_as_string UUID_V4 ];
use JSON::XS;

BEGIN {
    use_ok('Plack::Debugger');
    use_ok('Plack::Debugger::Storage');

    use_ok('Plack::App::Debugger');

    use_ok('Plack::Middleware::Debugger::Injector');
}

# testing stuff ...
my @UUIDS;
my $FILE_ID  = 0;
my $JSON     = JSON::XS->new->utf8->pretty;

# data the Debugger needs
my $DATA_DIR = dir('./t/tmp/');
my $BASE_URL = '/debugger';

# cleanup tmp dir
{ -f $_ && $_->remove foreach $DATA_DIR->children( no_hidden => 1 ) }

my $debugger = Plack::Debugger->new(
    uid_generator => sub { 
        push @UUIDS => create_uuid_as_string(UUID_V4);
        $UUIDS[-1];
    },
    storage => Plack::Debugger::Storage->new(
        data_dir     => $DATA_DIR,
        serializer   => sub { $JSON->encode( shift ) },
        deserializer => sub { $JSON->decode( shift ) },
        filename_fmt => "%s.json",
    ),
    panels => [
        Plack::Debugger::Panel->new(
            title     => 'Tester',
            subtitle  => '... testing all the things',
            before    => sub { 
                my ($self, $env) = @_;
                $self->stash([ 'started request at ' . $env->{'PATH_INFO'} ]); 
            },
            after     => sub { 
                my ($self, $env, $resp) = @_;
                push @{ $self->stash } => 'finished request with status ' . $resp->[0];
            },
            cleanup   => sub {
                my ($self, $env) = @_;
                push @{ $self->stash } => 'cleaning up request';
                $self->set_result( $self->stash ); 
            }
        )
    ]
);


my $INJECTED = q[<script src="] . $BASE_URL . q[/debugger.js"></script>];

my $app = builder {

    mount $BASE_URL => Plack::App::Debugger->new( debugger => $debugger )->to_app;

    mount '/' => builder {
        enable 'Plack::Middleware::Debugger::Injector'  => ( content => $INJECTED );
        enable $debugger->make_collector_middleware;
        sub {
            my $env = shift;
            [ 
                200, 
                [ 
                    'Content-Type'   => 'text/html',
                    'Content-Length' => 37
                ], 
                [ '<html><body>HELLO WORLD</body></html>' ]
            ]
        }
    }
};

test_psgi($app, sub {
        my $cb  = shift;
        {

            is((scalar grep { /.*\.json$/ } $DATA_DIR->children), 0, '... no data has been written yet');

            my $resp = $cb->(GET '/');  

            is($resp->headers->header('Content-Length'), 37 + length($INJECTED), '... got the expected expanded Content-Length');
            is(
                $resp->content, 
                '<html><body>HELLO WORLD' . $INJECTED . '</body></html>', 
                '... got the right content'
            );

            my $data_file = $DATA_DIR->file( sprintf "%s.json" => $UUIDS[-1] );

            ok(-e $data_file, '... data has now been written');

            is_deeply(
                $debugger->load_results( $UUIDS[-1] ),
                {
                    'Tester' => [
                        'started request at /',
                        'finished request with status 200',
                        'cleaning up request'
                    ]
                },
                '... got the expected collected data in the data-dir'
            );
        }
    }
);

done_testing;







