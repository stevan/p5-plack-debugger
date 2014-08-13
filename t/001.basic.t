#!/usr/bin/perl

use strict;
use warnings;

use Test::More;

use Plack::Test;    
use HTTP::Request::Common qw[ GET ];
use Path::Class           qw[ dir ];
use JSON::XS;

BEGIN {
    use_ok('Plack::Debugger');
}

my $FILE_ID  = 0;
my $DATA_DIR = dir('./t/tmp/');

# cleanup tmp dir
{ -f $_ && $_->remove foreach $DATA_DIR->children( no_hidden => 1 ) }

my $debugger = Plack::Debugger->new(
    data_dir     => $DATA_DIR,
    serializer   => sub { JSON::XS->new->pretty->encode( shift ) },
    filename_gen => sub { sprintf "test-%03d.json" => ++$FILE_ID },
    panels       => [
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
                $self->set_result( $self->stash ); 
            },
        )
    ]
);


my $app = sub {
    my $env = shift;
    [ 200, [], [ 'HELLO WORLD from ' . $env->{'PATH_INFO'} ]]
};

test_psgi(
    Plack::Middleware::Debugger::Collector->wrap( 
        $app,
        ( 
            debugger => $debugger 
        )
    ),
    sub {
        my $cb  = shift;
        {
            my $data_file = $DATA_DIR->file('test-001.json');

            ok(!-e $data_file, '... no data has been written yet');

            my $res = $cb->(GET '/test');  
            is($res->content, 'HELLO WORLD from /test', '... got the right content');

            ok(-e $data_file, '... data has now been written');

            is_deeply(
                [ map { $_->get_result } @{ $debugger->panels } ],
                [
                    [
                        'started request at /test',
                        'finished request with status 200'
                    ]
                ],
                '... got the expected collected data in the Debugger panels'
            );

            is_deeply(
                JSON::XS->new->decode( scalar $data_file->slurp( chomp => 1 ) ),
                {
                    'Tester' => [
                        'started request at /test',
                        'finished request with status 200'
                    ]
                },
                '... got the expected collected data in the data-dir'
            );
        }
    }
);

done_testing;







